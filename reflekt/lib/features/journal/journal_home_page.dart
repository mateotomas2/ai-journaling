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
import '../chat/day_chat.dart';
import 'search_page.dart';

/// Keys the specs drive. Keep these stable — renaming one breaks a recording.
class JournalHomeKeys {
  static const emptyState = Key('journal_empty_state');
  static const addNote = Key('journal_add_note');
  static const noteList = Key('journal_note_list');
  static const dayPager = Key('journal_day_pager');
  static const dayHeader = Key('journal_day_header');
  static const showNotes = Key('journal_show_notes');
  static const showChat = Key('journal_show_chat');
  static const search = Key('journal_search');
  static const settings = Key('journal_settings');
  static const ask = Key('journal_ask');
  static const findByMeaning = Key('journal_find_by_meaning');

  /// One per category, so a spec can name the filter it means.
  static Key filterOf(String id) => Key('journal_filter_$id');
}

/// Which of a day's two surfaces is showing.
enum _DayView { notes, chat }

/// Where that choice is kept, so it survives closing the app. In the journal
/// rather than in shared preferences: it is a small fact about how someone
/// uses their journal, and it belongs with the journal.
const _viewSetting = 'journal.day_view';

/// The journal, one day to a page.
///
/// Days are laid out as a line and moved along by swiping, which is what a
/// phone does with a line. Chevrons were two tap targets to travel one day —
/// a desktop idiom that survived the port and made the header a toolbar.
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
  /// The page controller is reversed, so swiping *right* — the gesture for
  /// turning back — moves to an earlier day. Page 0 is today and there is no
  /// page before it: days that have not happened cannot hold anything, so the
  /// pager simply does not extend into them.
  final _pages = PageController();

  late DateTime _today;

  /// How many days back the visible page is. 0 is today.
  int _daysAgo = 0;

  /// Bumped to make the visible day reload after something is written or
  /// erased. A day page reads its own notes, so it needs telling.
  int _revision = 0;

  /// Which of the day's two surfaces is showing. Held here rather than inside
  /// the pager, or swiping to another day would reset it — and the choice is
  /// about how you are reading the journal, not about which day.
  _DayView _view = _DayView.notes;

  @override
  void initState() {
    super.initState();
    _today = _dateOnly(widget.clock());
    _restoreView();
  }

  /// Remembers which surface was last used. Someone who journals by writing
  /// and someone who journals by talking should each find their own way of
  /// doing it when they open the app, rather than the other one's.
  Future<void> _restoreView() async {
    final saved = await widget.session.database.setting(_viewSetting);
    if (!mounted || saved == null) return;
    setState(() => _view = saved == _DayView.chat.name
        ? _DayView.chat
        : _DayView.notes);
  }

  void _show(_DayView view) {
    setState(() => _view = view);
    widget.session.database.putSetting(_viewSetting, view.name);
  }

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  /// Days are compared by date, never by instant — two moments in the same day
  /// are the same page of the journal.
  DateTime _dateOnly(DateTime moment) =>
      DateTime(moment.year, moment.month, moment.day);

  DateTime get _day => _today.subtract(Duration(days: _daysAgo));

  bool get _isToday => _daysAgo == 0;

  /// Brings a given day into view, rolling the pager's origin forward first if
  /// the clock has passed midnight since this page was built.
  void _goToDay(DateTime day) {
    final today = _dateOnly(widget.clock());
    final daysAgo = today.difference(_dateOnly(day)).inDays;
    if (daysAgo < 0) return;

    setState(() {
      _today = today;
      _daysAgo = daysAgo;
      _revision++;
    });
    if (_pages.hasClients) _pages.jumpToPage(daysAgo);
  }

  /// Jumping to an arbitrary date, for when the day you want is further back
  /// than anyone wants to swipe. Also what makes the swipe discoverable: the
  /// date is visibly a control, so the header is worth touching.
  Future<void> _pickDay() async {
    final chosen = await showDatePicker(
      context: context,
      initialDate: _day,
      firstDate: DateTime(2020),
      lastDate: _dateOnly(widget.clock()),
    );
    if (chosen != null) _goToDay(chosen);
  }

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
    await _remember(IndexedKind.note, id, result.text);
    if (!mounted) return;
    _goToDay(_dateOnly(now));
  }

  /// Records what a note means so it can be found later.
  ///
  /// Failure is swallowed on purpose: an embedding is an index, and losing one
  /// must never cost someone the note they just wrote. #14 covers noticing and
  /// repairing the gap.
  Future<void> _remember(
    IndexedKind kind,
    String id,
    String content,
  ) async {
    try {
      final embedder = await JournalEmbedder.load();
      final vector = await embedder.embed(content);
      await widget.session.database
          .putEmbeddingFor(kind, id, JournalEmbedder.toBytes(vector));
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
        await _remember(IndexedKind.note, note.id, text);
      case NoteDeleted():
        await database.deleteNote(note.id, widget.clock());
        // Erasing the text but leaving its vector would let a deleted note
        // keep surfacing in meaning search (ADR-0007).
        await database.removeEmbedding(note.id);
    }
    if (!mounted) return;
    setState(() => _revision++);
  }

  /// The AI as configured, or null when no key has been saved.
  ///
  /// Read at the moment it is needed rather than held, so a key or model
  /// changed in Settings takes effect without restarting the app.
  Future<JournalAi?> _configuredAi() async {
    if (widget.ai != null) return widget.ai;

    final database = widget.session.database;
    final key = await database.setting(openRouterKeySetting);
    if (key == null) return null;

    final model = await database.setting(AiSettings.modelSetting);
    final prompt = await database.setting(AiSettings.promptSetting);
    return OpenRouterAi(
      apiKey: key,
      model: model ?? AiSettings.defaultModel,
      systemPrompt: prompt,
    );
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

  Future<void> _findByMeaning() async {
    final day = await Navigator.of(context).push<DateTime>(
      MaterialPageRoute(
        builder: (_) => MeaningSearchPage(database: widget.session.database),
      ),
    );
    if (day != null && mounted) _goToDay(day);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        // No title: the date below names the page, and at display size. A
        // wordmark here would be the second-loudest thing on a screen whose
        // subject is someone's writing.
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
            onPressed: _findByMeaning,
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
                builder: (_) => SettingsPage(
                  database: widget.session.database,
                  onChangePassword: (current, replacement) =>
                      widget.session.changePassword(
                    current: current,
                    replacement: replacement,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      // Writing a note is the thing that always works — no key, no signal, no
      // account. It is offered on the notes surface only, because a button
      // that opens a composer over a conversation is answering a question
      // nobody asked.
      floatingActionButton: _view == _DayView.notes
          ? FloatingActionButton.extended(
              key: JournalHomeKeys.addNote,
              onPressed: _composeNote,
              icon: const Icon(Icons.edit_outlined),
              label: const Text('New note'),
            )
          : null,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Both outside the pager on purpose. The header names which page you
          // are on, and the toggle is about how you are reading the journal
          // rather than about which day — inside, a swipe would reset it.
          _DayHeader(day: _day, isToday: _isToday, onPick: _pickDay),
          _ViewToggle(showing: _view, onShow: _show),
          Expanded(
            child: PageView.builder(
              key: JournalHomeKeys.dayPager,
              controller: _pages,
              reverse: true,
              onPageChanged: (page) => setState(() => _daysAgo = page),
              itemBuilder: (context, page) {
                final day = _today.subtract(Duration(days: page));

                if (_view == _DayView.chat) {
                  return FutureBuilder<JournalAi?>(
                    // Rebuilt per day so each page reads its own conversation.
                    key: ValueKey('chat-${dayIdOf(day)}#$_revision'),
                    future: _configuredAi(),
                    builder: (context, snapshot) {
                      if (snapshot.connectionState != ConnectionState.done) {
                        return const Center(child: CircularProgressIndicator());
                      }
                      return DayChat(
                        database: widget.session.database,
                        day: day,
                        ai: snapshot.data,
                        clock: widget.clock,
                        onRemember: _remember,
                        // The assistant writes through the same tools a person
                        // taps, so the notes surface has to be told to re-read
                        // rather than being written to twice.
                        onJournalChanged: () => _revision++,
                      );
                    },
                  );
                }

                return _DayPage(
                  // The revision forces a reload after a write; without it the
                  // page keeps showing the notes it read when it was built.
                  key: ValueKey('${dayIdOf(day)}#$_revision'),
                  database: widget.session.database,
                  day: day,
                  isToday: page == 0,
                  onOpen: _openNote,
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Which of the day's two surfaces to show.
///
/// Deliberately not a tab bar: these are two ways of putting something into
/// the same day, not two sections of an app. It sits under the date because
/// what it switches belongs to that day.
class _ViewToggle extends StatelessWidget {
  const _ViewToggle({required this.showing, required this.onShow});

  final _DayView showing;
  final void Function(_DayView view) onShow;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
      child: Row(
        children: [
          _Choice(
            key: JournalHomeKeys.showNotes,
            label: 'Notes',
            chosen: showing == _DayView.notes,
            onChoose: () => onShow(_DayView.notes),
          ),
          const SizedBox(width: 8),
          _Choice(
            key: JournalHomeKeys.showChat,
            label: 'Chat',
            chosen: showing == _DayView.chat,
            onChoose: () => onShow(_DayView.chat),
          ),
        ],
      ),
    );
  }
}

class _Choice extends StatelessWidget {
  const _Choice({
    super.key,
    required this.label,
    required this.chosen,
    required this.onChoose,
  });

  final String label;
  final bool chosen;
  final VoidCallback onChoose;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: onChoose,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: chosen
              ? theme.colorScheme.secondary.withValues(alpha: 0.18)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: chosen ? Colors.transparent : theme.colorScheme.outline,
          ),
        ),
        child: Text(
          label,
          style: theme.textTheme.labelLarge?.copyWith(
            color: chosen
                ? theme.colorScheme.onSurface
                : theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ),
    );
  }
}

/// The date, at the top of the day it names.
class _DayHeader extends StatelessWidget {
  const _DayHeader({
    required this.day,
    required this.isToday,
    required this.onPick,
  });

  final DateTime day;
  final bool isToday;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return InkWell(
      key: JournalHomeKeys.dayHeader,
      onTap: onPick,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isToday ? 'Today' : formatWeekdayLabel(day),
              style: theme.textTheme.labelSmall
                  ?.copyWith(color: theme.colorScheme.primary),
            ),
            const SizedBox(height: 2),
            Text(formatDayLabel(day), style: theme.textTheme.displayLarge),
          ],
        ),
      ),
    );
  }
}

/// One day, read from the encrypted database.
class _DayPage extends StatefulWidget {
  const _DayPage({
    super.key,
    required this.database,
    required this.day,
    required this.isToday,
    required this.onOpen,
  });

  final JournalDatabase database;
  final DateTime day;
  final bool isToday;
  final void Function(Note note) onOpen;

  @override
  State<_DayPage> createState() => _DayPageState();
}

class _DayPageState extends State<_DayPage> {
  late final Future<List<Note>> _notes =
      widget.database.notesForDay(dayIdOf(widget.day));

  NoteCategory? _filter;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Note>>(
      future: _notes,
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final all = snapshot.data!;
        if (all.isEmpty) return _EmptyState(isToday: widget.isToday);

        final notes = _filter == null
            ? all
            : all.where((n) => n.category == _filter!.id).toList();

        // Only what this day actually holds — a chip with nothing behind it is
        // a dead end.
        final present = {
          for (final n in all)
            if (NoteCategory.fromId(n.category) != null)
              NoteCategory.fromId(n.category)!,
        };

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Offered whenever the day holds anything categorised. Even a
            // single chip is useful: it hides the notes that were never
            // sorted, which is most of the point.
            if (present.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
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
                onOpen: widget.onOpen,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.isToday});

  final bool isToday;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Center(
      key: JournalHomeKeys.emptyState,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 48),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              isToday
                  ? 'Nothing written today yet.'
                  : 'Nothing was written this day.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyLarge
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 8),
            Text(
              'Swipe right for earlier days.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

/// The day's writing.
///
/// Entries are set as text on the page, separated by a hairline, rather than
/// as cards: a note is something someone wrote, not a panel of data (ADR-0008).
class _NoteList extends StatelessWidget {
  const _NoteList({required this.notes, required this.onOpen});

  final List<Note> notes;
  final void Function(Note note) onOpen;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ListView.separated(
      key: JournalHomeKeys.noteList,
      padding: const EdgeInsets.only(bottom: 96),
      itemCount: notes.length,
      separatorBuilder: (_, _) => const Divider(indent: 20, endIndent: 20),
      itemBuilder: (context, index) {
        final note = notes[index];
        final category = NoteCategory.fromId(note.category);
        final written = DateTime.fromMillisecondsSinceEpoch(note.createdAt);

        return InkWell(
          onTap: () => onOpen(note),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // The time and what it was about, above the entry and quiet:
                // they say where the writing came from, and then get out of
                // the way of it.
                // Each part its own Text, rather than one joined string. The
                // category is a thing the journal is showing you, so it has to
                // be findable as itself — joining it into "09:30 · Dream"
                // makes it a substring of something else, which is how it
                // stopped being visible to the spec that asks for it.
                Row(
                  children: [
                    Text(formatTimeLabel(written), style: theme.textTheme.labelSmall),
                    if (category != null) ...[
                      Text('   ·   ', style: theme.textTheme.labelSmall),
                      // Written the way the filter chip writes it: two casings
                      // for one category on one screen is not a style.
                      Text(category.label, style: theme.textTheme.labelSmall),
                    ],
                  ],
                ),
                const SizedBox(height: 6),
                Text(note.content, style: theme.textTheme.bodyLarge),
              ],
            ),
          ),
        );
      },
    );
  }
}
