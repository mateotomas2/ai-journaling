import 'dart:async';

import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';

import '../../core/clock.dart';
import '../../core/day_id.dart';
import '../../db/journal_database.dart';
import '../ai/journal_ai.dart';
import '../ai/journal_tools.dart';

/// Keys the specs drive. Keep these stable — renaming one breaks a recording.
class ChatKeys {
  static const field = Key('chat_field');
  static const send = Key('chat_send');
  static const thread = Key('chat_thread');
  static const arriving = Key('chat_arriving');
  static const empty = Key('chat_empty');
  static const error = Key('chat_error');
  static const doing = Key('chat_doing');
  static const noKey = Key('chat_no_key');
}

/// A day's conversation.
///
/// The second way of putting something into a day, beside writing a note. It
/// belongs to the day it happened on and is read back from the encrypted
/// database like everything else — a conversation about your life is not
/// scratch state, and losing it on a lock would make it one.
class DayChat extends StatefulWidget {
  const DayChat({
    super.key,
    required this.database,
    required this.day,
    required this.ai,
    this.clock = systemClock,
    this.onRemember,
    this.onJournalChanged,
    this.onSpend,
  });

  final JournalDatabase database;
  final DateTime day;

  /// Null when no OpenRouter key has been saved. The conversation is still
  /// readable — what was said does not stop being yours because the key
  /// expired — but nothing new can be asked.
  final JournalAi? ai;

  final Clock clock;

  /// Records what something means, so it can be found later by meaning.
  final Future<void> Function(IndexedKind kind, String id, String content)?
      onRemember;

  /// Told when the assistant changed the journal, so the day being displayed
  /// can catch up with what is now in it.
  final VoidCallback? onJournalChanged;

  /// Told what a request cost, each time one is billed.
  final Future<void> Function(double cost, int tokens)? onSpend;

  @override
  State<DayChat> createState() => _DayChatState();
}

/// The tools that leave the journal different from how they found it.
const _changesTheJournal = {'write_note', 'update_note', 'delete_note'};

class _DayChatState extends State<DayChat> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();

  List<Message>? _thread;

  /// The reply so far, while it is still being written. Kept out of [_thread]
  /// until it is finished, so a half-written answer is never mistaken for one
  /// the model completed — and never written to the database as one.
  String? _arriving;

  /// What the assistant is doing to the journal right now, if anything. Named
  /// by tool, and turned into a sentence at the point of showing it.
  String? _doing;

  String? _error;
  bool _thinking = false;
  bool _canSend = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      final canSend = _controller.text.trim().isNotEmpty;
      if (canSend != _canSend) setState(() => _canSend = canSend);
    });
    _load();
  }

  @override
  void dispose() {
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final thread = await widget.database.messagesForDay(dayIdOf(widget.day));
    if (!mounted) return;
    setState(() => _thread = thread);
    _showLatest();
  }

  /// Keeps the newest turn in view. A conversation that leaves its latest
  /// answer below the fold makes you scroll to find out what it said.
  void _showLatest() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  /// What was said before, as pairs, so a follow-up can lean on it.
  ///
  /// Built from what is stored rather than kept alongside it: two records of
  /// the same conversation drift, and the stored one is the one that survives
  /// a lock.
  List<Exchange> get _earlier {
    final exchanges = <Exchange>[];
    String? asked;
    for (final message in _thread ?? const <Message>[]) {
      if (message.role == MessageRole.user.name) {
        asked = message.content;
      } else if (asked != null) {
        exchanges.add(Exchange(asked, message.content));
        asked = null;
      }
    }
    return exchanges;
  }

  Future<void> _send() async {
    final said = _controller.text.trim();
    final ai = widget.ai;
    if (said.isEmpty || _thinking || ai == null) return;

    final now = widget.clock();
    final earlier = _earlier;
    final saidId = now.microsecondsSinceEpoch.toString();

    // Written down before it is answered. If the answer fails, what the person
    // said is still theirs and still on the day they said it.
    await widget.database.addMessage(
      MessagesCompanion(
        id: Value(saidId),
        dayId: Value(dayIdOf(now)),
        role: Value(MessageRole.user.name),
        content: Value(said),
        createdAt: Value(now.millisecondsSinceEpoch),
      ),
    );

    // Indexed like a note, because it is the person's own writing (ADR-0010).
    // The assistant's reply is never indexed, which is why this happens here
    // rather than around both.
    //
    // Deliberately not awaited. Embedding loads a model the first time it is
    // asked, and making someone wait on an *index* before they can be answered
    // gets the priority exactly backwards. If it fails or lags, the backfill
    // on the meaning-search page picks it up — that is what it is for.
    unawaited(
      Future(() => widget.onRemember?.call(IndexedKind.message, saidId, said)),
    );

    _controller.clear();
    if (!mounted) return;
    setState(() {
      _error = null;
      _thinking = true;
    });
    await _load();

    try {
      // The day on screen, and nothing else. Reaching other days is something
      // the assistant does through search_journal_memory when it decides it
      // needs to — rather than this guessing up front, paying for an embedding
      // on every message and sending entries the question may have nothing to
      // do with (ADR-0009).
      final entries = [
        for (final note in await widget.database.notesForDay(dayIdOf(widget.day)))
          note.content,
      ];

      // What the assistant may do, scoped to the day on screen — "read the
      // notes" means this day unless it says otherwise.
      final tools = journalTools(
        database: widget.database,
        day: widget.day,
        clock: widget.clock,
        remember: (id, content) async =>
            widget.onRemember?.call(IndexedKind.note, id, content),
      );

      Answer? answer;
      final written = StringBuffer();

      await for (final event in ai.ask(
        question: said,
        entries: entries,
        earlier: earlier,
        tools: tools,
      )) {
        if (!mounted) return;
        switch (event) {
          case AiText(:final delta):
            written.write(delta);
            setState(() => _arriving = written.toString());
            _showLatest();
          case AiToolRan(:final tool):
            // Said out loud, so a pause explains itself. Someone waiting
            // deserves to know their journal is being read rather than that
            // the app has stopped.
            setState(() => _doing = tool);
            // A tool may have written or erased something. The notes surface
            // is one swipe away and would otherwise still show what was there
            // before.
            if (_changesTheJournal.contains(tool)) {
              widget.onJournalChanged?.call();
            }
          case AiSpent(:final cost, :final tokens):
            // Recorded as it happens rather than at the end, so an answer that
            // fails part-way still accounts for what it already spent — the
            // money is gone either way.
            await widget.onSpend?.call(cost, tokens);
          case AiFinished(answer: final finished):
            answer = finished;
        }
      }

      if (answer == null) {
        throw const JournalAiException('The answer stopped part-way.');
      }

      final replied = widget.clock();
      await widget.database.addMessage(
        MessagesCompanion(
          id: Value(replied.microsecondsSinceEpoch.toString()),
          dayId: Value(dayIdOf(now)),
          role: Value(MessageRole.assistant.name),
          content: Value(answer.reply),
          createdAt: Value(replied.millisecondsSinceEpoch),
        ),
      );

      if (!mounted) return;
      setState(() {
        _arriving = null;
        _doing = null;
        _thinking = false;
      });
      await _load();
    } on JournalAiException catch (failure) {
      if (!mounted) return;
      setState(() {
        // What arrived is dropped rather than kept: a partial reply left on
        // screen beside an error reads as a reply that is merely short. What
        // the person said stays, because it is already written down.
        _arriving = null;
        _doing = null;
        _error = failure.message;
        _thinking = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final thread = _thread;
    if (thread == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return Column(
      children: [
        Expanded(
          child: thread.isEmpty && _arriving == null
              ? const _NothingSaidYet()
              : ListView(
                  key: ChatKeys.thread,
                  controller: _scroll,
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                  children: [
                    for (final message in thread)
                      _Turn(
                        text: message.content,
                        mine: message.role == MessageRole.user.name,
                      ),

                    // The reply as it is being written. Shown as the
                    // assistant's turn so it lands where the finished one
                    // will, rather than moving when it completes.
                    if (_arriving != null)
                      _Turn(
                        key: ChatKeys.arriving,
                        text: _arriving!,
                        mine: false,
                      ),

                    // What it is doing, while it is doing it. Preferred over
                    // the spinner: naming the action is more reassuring than
                    // animating, and quieter than either is not an option
                    // while someone waits.
                    if (_doing != null && _arriving == null)
                      _Doing(_doing!)
                    else if (_thinking && _arriving == null)
                      const _Thinking(),
                  ],
                ),
        ),
        if (_error != null) _Complaint(_error!),
        _Composer(
          controller: _controller,
          enabled: widget.ai != null,
          canSend: _canSend && !_thinking,
          onSend: _send,
        ),
      ],
    );
  }
}

/// One turn of the conversation.
///
/// The person's words sit in a container and are set in the reading face; the
/// assistant's run full width in the interface face. The serif is the person's
/// voice (ADR-0008) — which is the whole difference between a journal with an
/// assistant in it and a chat app with a warm palette.
class _Turn extends StatelessWidget {
  const _Turn({super.key, required this.text, required this.mine});

  final String text;
  final bool mine;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (!mine) {
      return Padding(
        padding: const EdgeInsets.only(top: 12, bottom: 20, right: 8),
        child: Text(text, style: theme.textTheme.bodyMedium),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Align(
        alignment: Alignment.centerRight,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: MediaQuery.sizeOf(context).width * 0.78,
          ),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Text(text, style: theme.textTheme.bodyLarge),
          ),
        ),
      ),
    );
  }
}

class _Thinking extends StatelessWidget {
  const _Thinking();

  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(
          child: SizedBox(
            height: 18,
            width: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
}

/// What the assistant is doing to the journal, in a sentence.
///
/// Deliberately plain and deliberately small. It is a footnote about how an
/// answer was arrived at, not a feature to show off — and a journal narrating
/// its own machinery loudly would be tiring to sit with.
class _Doing extends StatelessWidget {
  const _Doing(this.tool);

  final String tool;

  static const _sentences = <String, String>{
    'search_journal_memory': 'Looking through your journal',
    'read_notes': 'Reading that day',
    'write_note': 'Writing that down',
    'update_note': 'Changing that note',
    'delete_note': 'Erasing that note',
  };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      key: ChatKeys.doing,
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        children: [
          SizedBox(
            height: 12,
            width: 12,
            child: CircularProgressIndicator(
              strokeWidth: 1.5,
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(width: 10),
          Text(
            // An unknown tool still says something true rather than nothing.
            _sentences[tool] ?? 'Working on it',
            style: theme.textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _NothingSaidYet extends StatelessWidget {
  const _NothingSaidYet();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Center(
      key: ChatKeys.empty,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 48),
        child: Text(
          'Nothing said today.',
          textAlign: TextAlign.center,
          style: theme.textTheme.bodyLarge
              ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
        ),
      ),
    );
  }
}

class _Complaint extends StatelessWidget {
  const _Complaint(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      key: ChatKeys.error,
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        message,
        style: theme.textTheme.bodySmall
            ?.copyWith(color: theme.colorScheme.onErrorContainer),
      ),
    );
  }
}

/// Where you say something. Anchored to the bottom, where a phone's keyboard
/// comes from.
class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.enabled,
    required this.canSend,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool enabled;
  final bool canSend;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                key: ChatKeys.field,
                controller: controller,
                enabled: enabled,
                minLines: 1,
                maxLines: 5,
                textInputAction: TextInputAction.newline,
                decoration: InputDecoration(
                  // Says why it cannot be used, at the moment it matters,
                  // rather than as a banner someone learns to ignore.
                  hintText: enabled
                      ? 'Say something about today'
                      : 'Add an OpenRouter key in Settings',
                  hintStyle: enabled
                      ? null
                      : theme.textTheme.bodyMedium
                          ?.copyWith(color: theme.colorScheme.error),
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              key: ChatKeys.send,
              onPressed: canSend ? onSend : null,
              icon: const Icon(Icons.arrow_upward),
              tooltip: 'Send',
            ),
          ],
        ),
      ),
    );
  }
}
