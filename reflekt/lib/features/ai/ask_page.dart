import 'package:flutter/material.dart';

import '../../db/journal_database.dart';
import '../memory/journal_embedder.dart';
import '../memory/meaning_search.dart';
import 'journal_ai.dart';

/// Keys the specs drive. Keep these stable — renaming one breaks a recording.
class AskKeys {
  static const field = Key('ask_field');
  static const submit = Key('ask_submit');
  static const answer = Key('ask_answer');
  static const arriving = Key('ask_arriving');
  static const error = Key('ask_error');
}

/// Asks a question of everything written so far.
class AskPage extends StatefulWidget {
  const AskPage({
    super.key,
    required this.database,
    required this.ai,
    this.onWriteNote,
  });

  final JournalDatabase database;
  final JournalAi ai;

  /// Called when the assistant was asked to save something. Null means the
  /// caller does not allow writes from here.
  final Future<void> Function(String text)? onWriteNote;

  @override
  State<AskPage> createState() => _AskPageState();
}

class _AskPageState extends State<AskPage> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();

  /// Oldest first. Held in memory only — the thread is as private as the
  /// entries it was drawn from, so it does not outlive the unlocked session.
  final _thread = <Exchange>[];

  String? _pending;
  String? _error;
  bool _thinking = false;

  /// The answer so far, while it is still being written. Null when nothing is
  /// arriving. Kept apart from [_thread] so a half-written answer is never
  /// mistaken for one the model finished.
  String? _arriving;

  @override
  void dispose() {
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  /// Brings the newest exchange into view. A conversation that leaves its
  /// latest answer below the fold makes you scroll to find out what it said,
  /// which is a strange way to be answered.
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

  Future<void> _ask() async {
    final question = _controller.text.trim();
    if (question.isEmpty || _thinking) return;

    // The field is cleared and the question shown in the thread, so it reads
    // as a conversation rather than an input box echoing itself.
    _controller.clear();
    setState(() {
      _pending = question;
      _error = null;
      _thinking = true;
    });

    try {
      // Only the entries this question is about. Sending the whole journal
      // was the earlier behaviour: it grows more expensive the longer someone
      // keeps writing, and exposes years of entries to answer something about
      // a week of them.
      //
      // Falls back to everything if the index cannot be used, because an
      // answer from too much context is better than no answer at all — but the
      // fallback is loud in the logs rather than silent.
      List<String> entries;
      try {
        final embedder = await JournalEmbedder.load();
        entries = await MeaningSearch(widget.database, embedder)
            .contextFor(question);
      } catch (error) {
        debugPrint('CONTEXT_FALLBACK $error');
        entries = await widget.database.allNoteContents();
      }
      if (entries.isEmpty) {
        entries = await widget.database.allNoteContents();
      }
      Answer? answer;
      final written = StringBuffer();

      await for (final event in widget.ai.ask(
        question: question,
        entries: entries,
        earlier: List.unmodifiable(_thread),
      )) {
        if (!mounted) return;
        switch (event) {
          case AiText(:final delta):
            // Shown as it arrives. The scroll follows it, or a long answer
            // writes itself off the bottom of the screen while you watch the
            // top of it.
            written.write(delta);
            setState(() => _arriving = written.toString());
            _showLatest();
          case AiFinished(answer: final finished):
            answer = finished;
        }
      }

      // The stream ended without saying it was finished. The client raises for
      // this, so reaching here would mean a contract change went unnoticed —
      // better to say nothing happened than to commit half an answer.
      if (answer == null) {
        throw const JournalAiException('The answer stopped part-way.');
      }

      // Saved only when it was asked for. The write happens here rather than
      // inside the client so that the journal, not the model, owns what goes
      // into it.
      final toWrite = answer.noteToWrite;
      if (toWrite != null) await widget.onWriteNote?.call(toWrite);

      if (!mounted) return;
      setState(() {
        _thread.add(Exchange(question, answer!.reply));
        _pending = null;
        _arriving = null;
        _thinking = false;
      });
      _showLatest();
    } on JournalAiException catch (failure) {
      if (!mounted) return;
      setState(() {
        // The question stays visible on failure: retyping it to try again
        // would be the app losing your work.
        _controller.text = question;
        _pending = null;
        // Whatever had arrived is dropped. A partial answer left on screen
        // beside an error reads as an answer that is merely short.
        _arriving = null;
        _error = failure.message;
        _thinking = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Ask your journal')),
      body: ListView(
        controller: _scroll,
        padding: const EdgeInsets.all(20),
        children: [
          TextField(
            key: AskKeys.field,
            controller: _controller,
            autofocus: true,
            maxLines: null,
            onSubmitted: (_) => _ask(),
            decoration: const InputDecoration(
              hintText: 'What would you like to know?',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton(
            key: AskKeys.submit,
            onPressed: _thinking ? null : _ask,
            child: const Text('Ask'),
          ),
          const SizedBox(height: 24),

          // The thread, oldest first. An answer alone is hard to judge once
          // you have forgotten how you phrased the question.
          for (final exchange in _thread) ...[
            // The question in the reading face, the answer in the interface
            // one: the serif is the person's voice (ADR-0008).
            Text(exchange.question, style: theme.textTheme.titleLarge),
            const SizedBox(height: 8),
            Card(
              key: AskKeys.answer,
              margin: EdgeInsets.zero,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(exchange.answer, style: theme.textTheme.bodyMedium),
              ),
            ),
            const SizedBox(height: 20),
          ],

          if (_pending != null) ...[
            Text(_pending!, style: theme.textTheme.titleMedium),
            const SizedBox(height: 12),
          ],

          // The answer as it is being written. Once anything has arrived the
          // spinner goes: two signs that something is happening, one of which
          // is the actual answer, is one too many.
          if (_arriving != null)
            Card(
              key: AskKeys.arriving,
              margin: EdgeInsets.zero,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(_arriving!, style: theme.textTheme.bodyLarge),
              ),
            ),

          if (_thinking && _arriving == null)
            const Center(child: CircularProgressIndicator()),

          if (_error != null)
            Card(
              key: AskKeys.error,
              margin: EdgeInsets.zero,
              color: theme.colorScheme.errorContainer,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  _error!,
                  style: TextStyle(color: theme.colorScheme.onErrorContainer),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
