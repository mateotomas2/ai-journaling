import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';

import '../../core/clock.dart';
import '../../core/day_id.dart';
import '../../db/journal_database.dart';
import '../lock/journal_session.dart';
import 'note_composer_page.dart';
import '../ai/ask_page.dart';
import '../ai/journal_ai.dart';
import '../ai/openrouter_ai.dart';
import '../settings/settings_page.dart';
import 'search_page.dart';

/// Keys the specs drive. Keep these stable — renaming one breaks a recording.
class JournalHomeKeys {
  static const emptyState = Key('journal_empty_state');
  static const addNote = Key('journal_add_note');
  static const noteList = Key('journal_note_list');
  static const previousDay = Key('journal_previous_day');
  static const nextDay = Key('journal_next_day');
  static const search = Key('journal_search');
  static const settings = Key('journal_settings');
  static const ask = Key('journal_ask');
  static const summarise = Key('journal_summarise');
  static const summary = Key('journal_summary');
}

/// One day of the journal, read from the encrypted database.
class JournalHomePage extends StatefulWidget {
  const JournalHomePage({
    super.key,
    required this.session,
    this.clock = systemClock,
    this.ai,
  });

  final JournalSession session;
  final Clock clock;
  final JournalAi? ai;

  @override
  State<JournalHomePage> createState() => _JournalHomePageState();
}

class _JournalHomePageState extends State<JournalHomePage> {
  late DateTime _day;
  late Future<List<Note>> _notes;
  Summary? _summary;
  bool _summarising = false;

  @override
  void initState() {
    super.initState();
    _day = _dateOnly(widget.clock());
    _load();
  }

  /// Days are compared by date, never by instant — two moments in the same day
  /// are the same page of the journal.
  DateTime _dateOnly(DateTime moment) =>
      DateTime(moment.year, moment.month, moment.day);

  bool get _isToday => _day == _dateOnly(widget.clock());

  void _load() {
    _notes = widget.session.database.notesForDay(dayIdOf(_day));
    _loadSummary();
  }

  Future<void> _loadSummary() async {
    final stored = await widget.session.database.summaryForDay(dayIdOf(_day));
    if (!mounted) return;
    setState(() => _summary = stored);
  }

  /// Writes the summary down the first time and reads it back afterwards.
  /// Regenerating on every visit would spend money to say the same thing.
  Future<void> _summarise() async {
    if (_summarising) return;
    final database = widget.session.database;

    final ai = await _resolveAi();
    if (ai == null) return;

    final entries = (await database.notesForDay(dayIdOf(_day)))
        .map((n) => n.content)
        .toList();
    if (entries.isEmpty) return;

    setState(() => _summarising = true);
    try {
      final text = await ai.summarise(entries: entries);
      await database.putSummary(dayIdOf(_day), text, widget.clock());
      if (!mounted) return;
      await _loadSummary();
    } on JournalAiException catch (failure) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(failure.message)));
    } finally {
      if (mounted) setState(() => _summarising = false);
    }
  }

  /// The injected AI when a spec provides one, otherwise a real client built
  /// from the saved key. Returns null, having said why, when no key is set.
  Future<JournalAi?> _resolveAi() async {
    if (widget.ai != null) return widget.ai;
    final key = await widget.session.database.setting(openRouterKeySetting);
    if (!mounted) return null;
    if (key == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Add an OpenRouter key in Settings to use the AI.'),
        ),
      );
      return null;
    }
    return OpenRouterAi(apiKey: key);
  }

  void _goToDay(DateTime day) => setState(() {
        _day = day;
        _load();
      });

  Future<void> _composeNote() async {
    final result = await Navigator.of(context).push<ComposerResult>(
      MaterialPageRoute(builder: (_) => const NoteComposerPage()),
    );
    if (result is! NoteWritten) return;

    // Written onto the day it is being written, which is not necessarily the
    // day being read.
    final now = widget.clock();
    await widget.session.database.addNote(
      NotesCompanion(
        id: Value(now.microsecondsSinceEpoch.toString()),
        dayId: Value(dayIdOf(now)),
        content: Value(result.text),
        createdAt: Value(now.millisecondsSinceEpoch),
      ),
    );
    if (!mounted) return;
    _goToDay(_dateOnly(now));
  }

  Future<void> _openNote(Note note) async {
    final result = await Navigator.of(context).push<ComposerResult>(
      MaterialPageRoute(
        builder: (_) => NoteComposerPage(existingText: note.content),
      ),
    );
    if (result == null) return;

    final database = widget.session.database;
    switch (result) {
      case NoteWritten(:final text):
        await database.rewordNote(note.id, text);
      case NoteDeleted():
        await database.deleteNote(note.id, widget.clock());
    }
    if (!mounted) return;
    setState(_load);
  }

  /// Builds the AI from the saved key unless one was injected. Sending a
  /// question needs a key, so this is where the user finds out they have not
  /// set one — at the moment it matters, rather than as a banner they learn to
  /// ignore.
  Future<void> _ask() async {
    final ai = await _resolveAi();
    if (ai == null || !mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AskPage(database: widget.session.database, ai: ai),
      ),
    );
  }

  Future<void> _search() async {
    final day = await Navigator.of(context).push<DateTime>(
      MaterialPageRoute(
        builder: (_) => SearchPage(database: widget.session.database),
      ),
    );
    // Landing on the day a result came from, rather than on the note alone:
    // what surrounds an entry is usually why you went looking for it.
    if (day != null && mounted) _goToDay(day);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reflekt'),
        actions: [
          IconButton(
            key: JournalHomeKeys.search,
            icon: const Icon(Icons.search),
            tooltip: 'Search your journal',
            onPressed: _search,
          ),
          IconButton(
            key: JournalHomeKeys.summarise,
            icon: _summarising
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.subject),
            tooltip: 'Summarise this day',
            onPressed: _summarising ? null : _summarise,
          ),
          IconButton(
            key: JournalHomeKeys.ask,
            icon: const Icon(Icons.auto_awesome_outlined),
            tooltip: 'Ask your journal',
            onPressed: _ask,
          ),
          IconButton(
            key: JournalHomeKeys.settings,
            icon: const Icon(Icons.settings_outlined),
            tooltip: 'Settings',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => SettingsPage(database: widget.session.database),
              ),
            ),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(44),
          child: Padding(
            padding: const EdgeInsets.only(left: 8, right: 8, bottom: 8),
            child: Row(
              children: [
                IconButton(
                  key: JournalHomeKeys.previousDay,
                  icon: const Icon(Icons.chevron_left),
                  tooltip: 'Earlier day',
                  onPressed: () =>
                      _goToDay(_day.subtract(const Duration(days: 1))),
                ),
                Expanded(
                  child: Text(
                    formatDayLabel(_day),
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
                IconButton(
                  key: JournalHomeKeys.nextDay,
                  icon: const Icon(Icons.chevron_right),
                  tooltip: 'Later day',
                  // Days that have not happened cannot hold anything, so
                  // offering them would only lead somewhere empty.
                  onPressed: _isToday
                      ? null
                      : () => _goToDay(_day.add(const Duration(days: 1))),
                ),
              ],
            ),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        key: JournalHomeKeys.addNote,
        onPressed: _composeNote,
        icon: const Icon(Icons.edit_outlined),
        label: const Text('New note'),
      ),
      body: FutureBuilder<List<Note>>(
        future: _notes,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final notes = snapshot.data!;
          if (notes.isEmpty) return _EmptyState(isToday: _isToday);
          return Column(
            children: [
              // The summary sits above the writing, never replaces it: it is a
              // way back into the day, not a substitute for what was written.
              if (_summary != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                  child: Card(
                    key: JournalHomeKeys.summary,
                    margin: EdgeInsets.zero,
                    color: Theme.of(context).colorScheme.surfaceContainerHighest,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(_summary!.content),
                    ),
                  ),
                ),
              Expanded(
                child: _NoteList(
                  notes: notes.reversed.toList(),
                  onOpen: _openNote,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.isToday});

  final bool isToday;

  @override
  Widget build(BuildContext context) {
    return Center(
      key: JournalHomeKeys.emptyState,
      child: Text(
        isToday ? 'Nothing written today yet.' : 'Nothing was written this day.',
        style: Theme.of(context).textTheme.bodyLarge,
      ),
    );
  }
}

class _NoteList extends StatelessWidget {
  const _NoteList({required this.notes, required this.onOpen});

  final List<Note> notes;
  final void Function(Note note) onOpen;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      key: JournalHomeKeys.noteList,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      itemCount: notes.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final note = notes[index];
        return Card(
          margin: EdgeInsets.zero,
          child: ListTile(
            onTap: () => onOpen(note),
            title: Text(note.content),
            subtitle: Text(
              formatTimeLabel(
                DateTime.fromMillisecondsSinceEpoch(note.createdAt),
              ),
            ),
          ),
        );
      },
    );
  }
}
