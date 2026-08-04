import 'package:flutter/material.dart';

import '../../core/day_id.dart';
import '../../db/journal_database.dart';
import '../memory/index_backfill.dart';
import '../memory/journal_embedder.dart';
import '../memory/meaning_search.dart';

/// Keys the specs drive. Keep these stable — renaming one breaks a recording.
class SearchKeys {
  static const field = Key('search_field');
  static const byWords = Key('search_by_words');
  static const byMeaning = Key('search_by_meaning');
  static const submit = Key('search_submit');
  static const results = Key('search_results');
  static const nothingFound = Key('search_nothing_found');
  static const nothingIndexed = Key('search_nothing_indexed');
  static const thinking = Key('search_thinking');
  static const catchingUp = Key('search_catching_up');
}

/// Which way of looking is being used.
enum _How {
  /// The words you remember writing.
  words,

  /// What you remember it being about.
  meaning,
}

/// Finding something in the journal.
///
/// One screen, two ways of asking. They were two screens behind two icons,
/// which asked someone to know the difference between a substring match and a
/// vector search before they had typed anything — a question about the
/// implementation dressed up as a question about their journal.
///
/// Pops with the day a chosen result belongs to: a result you cannot get back
/// to is half an answer, and what surrounds an entry is usually why you went
/// looking for it.
class SearchPage extends StatefulWidget {
  const SearchPage({super.key, required this.database});

  final JournalDatabase database;

  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final _controller = TextEditingController();

  _How _how = _How.words;

  /// Results of a word search, which happens as you type.
  List<Note> _byWords = const [];
  bool _searchedWords = false;

  /// Results of a meaning search, which happens on submit.
  List<Match> _byMeaning = const [];
  bool _searchedMeaning = false;
  bool _thinking = false;
  int _indexed = 0;

  int _pending = 0;
  int _caughtUp = 0;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_searchWords);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Indexes anything written before the index existed, or missed by a failed
  /// embedding.
  ///
  /// Deferred until someone actually asks for a meaning search: starting a
  /// model to catch up when all they wanted was to find a word would be a
  /// strange way to spend their battery.
  Future<void> _catchUp() async {
    final embedder = await JournalEmbedder.load();
    await IndexBackfill(widget.database, embedder).run(
      onProgress: (done, total) {
        if (!mounted) return;
        setState(() {
          _caughtUp = done;
          _pending = total;
        });
      },
    );
    if (!mounted) return;
    setState(() => _pending = 0);
  }

  void _lookBy(_How how) {
    if (_how == how) return;
    setState(() => _how = how);
    if (how == _How.meaning) _catchUp();
  }

  /// As you type. A substring match over a few thousand rows is instant, so
  /// making someone press a button for it would be ceremony.
  Future<void> _searchWords() async {
    final query = _controller.text.trim();
    if (query.isEmpty) {
      setState(() {
        _byWords = const [];
        _searchedWords = false;
      });
      return;
    }

    final found = await widget.database.searchNotes(query);
    if (!mounted) return;
    setState(() {
      _byWords = found;
      _searchedWords = true;
    });
  }

  /// On submit, deliberately. Embedding a query runs a model; doing it per
  /// keystroke would heat the phone to answer questions nobody asked.
  Future<void> _searchMeaning() async {
    final query = _controller.text.trim();
    if (query.isEmpty || _thinking) return;

    setState(() => _thinking = true);
    final indexed = await widget.database.countEmbeddings();
    final embedder = await JournalEmbedder.load();
    final matches =
        await MeaningSearch(widget.database, embedder).search(query);

    if (!mounted) return;
    setState(() {
      _byMeaning = matches;
      _indexed = indexed;
      _searchedMeaning = true;
      _thinking = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          key: SearchKeys.field,
          controller: _controller,
          autofocus: true,
          textInputAction: TextInputAction.search,
          onSubmitted: (_) {
            if (_how == _How.meaning) _searchMeaning();
          },
          decoration: InputDecoration(
            hintText: _how == _How.words
                ? 'Search your journal'
                : 'What were you thinking about?',
            border: InputBorder.none,
          ),
        ),
        actions: [
          // Only where it does something. Words search as you type, so a
          // button there would be a control that never has anything to do.
          if (_how == _How.meaning)
            IconButton(
              key: SearchKeys.submit,
              icon: const Icon(Icons.search),
              tooltip: 'Search by meaning',
              onPressed: _thinking ? null : _searchMeaning,
            ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Row(
              children: [
                // Named by what someone wants, not by how it works. "Words"
                // and "meaning" are things you can be looking for; "full-text"
                // and "semantic" are things a database has.
                _Way(
                  key: SearchKeys.byWords,
                  label: 'Words',
                  chosen: _how == _How.words,
                  onChoose: () => _lookBy(_How.words),
                ),
                const SizedBox(width: 8),
                _Way(
                  key: SearchKeys.byMeaning,
                  label: 'Meaning',
                  chosen: _how == _How.meaning,
                  onChoose: () => _lookBy(_How.meaning),
                ),
              ],
            ),
          ),
        ),
      ),
      body: _how == _How.words ? _words() : _meaning(),
    );
  }

  Widget _words() {
    if (!_searchedWords) return const SizedBox.shrink();
    if (_byWords.isEmpty) {
      return const _Nothing(
        key: SearchKeys.nothingFound,
        said: 'Nothing matches that.',
      );
    }

    return _Results(
      entries: [
        for (final note in _byWords)
          (note.content, parseDayId(note.dayId), false),
      ],
    );
  }

  Widget _meaning() {
    if (_thinking) {
      return const Center(
        key: SearchKeys.thinking,
        child: CircularProgressIndicator(),
      );
    }

    if (_pending > 0) {
      return Center(
        key: SearchKeys.catchingUp,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 16),
            Text(
              'Catching up on older entries ($_caughtUp of $_pending)',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      );
    }

    if (!_searchedMeaning) return const SizedBox.shrink();

    if (_byMeaning.isEmpty && _indexed == 0) {
      // A different situation from "nothing matched", and saying so stops
      // someone concluding the search is broken when their journal simply has
      // not been indexed.
      return const _Nothing(
        key: SearchKeys.nothingIndexed,
        said: 'Nothing has been indexed yet.',
      );
    }
    if (_byMeaning.isEmpty) {
      return const _Nothing(
        key: SearchKeys.nothingFound,
        said: 'Nothing close enough to that.',
      );
    }

    return _Results(
      entries: [
        for (final match in _byMeaning)
          (
            match.entry.content,
            parseDayId(match.entry.dayId),
            match.entry.kind == IndexedKind.message,
          ),
      ],
    );
  }
}

class _Way extends StatelessWidget {
  const _Way({
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

class _Nothing extends StatelessWidget {
  const _Nothing({super.key, required this.said});

  final String said;

  @override
  Widget build(BuildContext context) => Center(
        child: Text(said, style: Theme.of(context).textTheme.bodyLarge),
      );
}

/// What was found, either way of looking.
///
/// One list for both, so a result reads the same whichever way you arrived at
/// it. How you searched is not a property of what you wrote.
class _Results extends StatelessWidget {
  const _Results({required this.entries});

  /// Content, the day it belongs to, and whether it was said rather than
  /// written down.
  final List<(String, DateTime, bool)> entries;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      key: SearchKeys.results,
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: entries.length,
      separatorBuilder: (_, _) => const Divider(indent: 20, endIndent: 20),
      itemBuilder: (context, index) {
        final (content, day, said) = entries[index];
        final theme = Theme.of(context);

        return InkWell(
          onTap: () => Navigator.of(context).pop(day),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(formatDayLabel(day), style: theme.textTheme.labelSmall),
                    if (said) ...[
                      Text('   ·   ', style: theme.textTheme.labelSmall),
                      Text('said', style: theme.textTheme.labelSmall),
                    ],
                  ],
                ),
                const SizedBox(height: 6),
                Text(content, style: theme.textTheme.bodyLarge),
              ],
            ),
          ),
        );
      },
    );
  }
}
