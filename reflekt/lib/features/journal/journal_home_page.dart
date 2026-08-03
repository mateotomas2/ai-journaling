import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';

import '../../core/clock.dart';
import '../../core/day_id.dart';
import '../../db/journal_database.dart';
import '../lock/journal_session.dart';
import 'note_category.dart';
import 'note_composer_page.dart';
import '../ai/ask_page.dart';
import '../ai/journal_ai.dart';
import '../ai/openrouter_ai.dart';
import '../memory/journal_embedder.dart';
import '../memory/meaning_search_page.dart';
import '../settings/ai_settings.dart';
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
  static const findByMeaning = Key('journal_find_by_meaning');

  /// One per category, so a spec can name the filter it means.
  static Key filterOf(String id) => Key('journal_filter_$id');
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
  NoteCategory? _filter;

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
    final id = now.microsecondsSinceEpoch.toString();
    await widget.session.database.addNote(
      NotesCompanion(
        id: Value(id),
        dayId: Value(dayIdOf(now)),
        content: Value(result.text),
        category: Value(result.category?.id ?? ''),
        createdAt: Value(now.millisecondsSinceEpoch),
      ),
    );
    await _remember(id, result.text);
    if (!mounted) return;
    _goToDay(_dateOnly(now));
  }

  /// Records what a note means so it can be found later.
  ///
  /// Failure is swallowed on purpose: an embedding is an index, and losing one
  /// must never cost someone the note they just wrote. #14 covers noticing and
  /// repairing the gap.
  Future<void> _remember(String noteId, String content) async {
    try {
      final embedder = await JournalEmbedder.load();
      final vector = await embedder.embed(content);
      await widget.session.database
          .putEmbedding(noteId, JournalEmbedder.toBytes(vector));
    } catch (error, stack) {
      // Left unindexed rather than unwritten — but not silently. Swallowing
      // this made a broken embedder look exactly like a search that found
      // nothing, which cost several runs to tell apart.
      debugPrint('EMBED_FAILED $error');
      debugPrintStack(stackTrace: stack, maxFrames: 4);
    }
  }

  Future<void> _openNote(Note note) async {
    final result = await Navigator.of(context).push<ComposerResult>(
      MaterialPageRoute(
        builder: (_) => NoteComposerPage(
          existingText: note.content,
          existingCategory: NoteCategory.fromId(note.category),
        ),
      ),
    );
    if (result == null) return;

    final database = widget.session.database;
    switch (result) {
      case NoteWritten(:final text, :final category):
        await database.rewordNote(note.id, text, category: category?.id ?? '');
        // Re-embedded, or the index keeps finding this note by what it used to
        // say — with the new text displayed, which looks like a working search
        // returning the wrong thing.
        await _remember(note.id, text);
      case NoteDeleted():
        await database.deleteNote(note.id, widget.clock());
        // Erasing the text but leaving its vector would let a deleted note
        // keep surfacing in meaning search (ADR-0007).
        await database.removeEmbedding(note.id);
    }
    if (!mounted) return;
    setState(_load);
  }

  /// Builds the AI from the saved key unless one was injected. Sending a
  /// question needs a key, so this is where the user finds out they have not
  /// set one — at the moment it matters, rather than as a banner they learn to
  /// ignore.
  Future<void> _ask() async {
    final database = widget.session.database;
    var ai = widget.ai;

    if (ai == null) {
      final key = await database.setting(openRouterKeySetting);
      if (!mounted) return;
      if (key == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Add an OpenRouter key in Settings to ask questions.'),
          ),
        );
        return;
      }
      // The saved choices, or the defaults. Read at the moment of asking so a
      // change in settings takes effect without restarting.
      final model = await database.setting(AiSettings.modelSetting);
      final prompt = await database.setting(AiSettings.promptSetting);
      ai = OpenRouterAi(
        apiKey: key,
        model: model ?? AiSettings.defaultModel,
        systemPrompt: prompt,
      );
    }

    if (!mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AskPage(database: database, ai: ai!),
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
            key: JournalHomeKeys.findByMeaning,
            icon: const Icon(Icons.travel_explore),
            tooltip: 'Find by meaning',
            onPressed: () async {
              final day = await Navigator.of(context).push<DateTime>(
                MaterialPageRoute(
                  builder: (_) =>
                      MeaningSearchPage(database: widget.session.database),
                ),
              );
              if (day != null && mounted) _goToDay(day);
            },
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
          final all = snapshot.data!;
          if (all.isEmpty) return _EmptyState(isToday: _isToday);

          final notes = _filter == null
              ? all
              : all.where((n) => n.category == _filter!.id).toList();

          // Only what this day actually holds — a chip with nothing behind it
          // is a dead end.
          final present = {
            for (final n in all)
              if (NoteCategory.fromId(n.category) != null)
                NoteCategory.fromId(n.category)!,
          };

          return Column(
            children: [
              // Offered whenever the day holds anything categorised. Even a
              // single chip is useful: it hides the notes that were never
              // sorted, which is most of the point.
              if (present.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Wrap(
                    spacing: 8,
                    children: [
                      for (final category in present)
                        FilterChip(
                          key: JournalHomeKeys.filterOf(category.id),
                          label: Text(category.label),
                          selected: _filter == category,
                          onSelected: (selected) => setState(
                            () => _filter = selected ? category : null,
                          ),
                        ),
                    ],
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
        final category = NoteCategory.fromId(note.category);
        return Card(
          margin: EdgeInsets.zero,
          child: ListTile(
            onTap: () => onOpen(note),
            title: Text(note.content),
            subtitle: Row(
              children: [
                Text(
                  formatTimeLabel(
                    DateTime.fromMillisecondsSinceEpoch(note.createdAt),
                  ),
                ),
                if (category != null) ...[
                  const SizedBox(width: 8),
                  Text('·'),
                  const SizedBox(width: 8),
                  Text(category.label),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
