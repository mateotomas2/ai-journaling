import 'package:flutter/material.dart';

import '../../core/day_id.dart';
import '../../db/journal_database.dart';
import 'index_backfill.dart';
import 'journal_embedder.dart';
import 'meaning_search.dart';

/// Keys the specs drive. Keep these stable — renaming one breaks a recording.
class MeaningSearchKeys {
  static const field = Key('meaning_field');
  static const results = Key('meaning_results');
  static const nothingFound = Key('meaning_nothing_found');
  static const nothingIndexed = Key('meaning_nothing_indexed');
  static const thinking = Key('meaning_thinking');
  static const submit = Key('meaning_submit');
  static const catchingUp = Key('meaning_catching_up');
}

/// Finding a note from a half-remembered idea.
///
/// Pops with the day a chosen result belongs to, like text search does: a
/// result you cannot get back to is half an answer.
class MeaningSearchPage extends StatefulWidget {
  const MeaningSearchPage({super.key, required this.database});

  final JournalDatabase database;

  @override
  State<MeaningSearchPage> createState() => _MeaningSearchPageState();
}

class _MeaningSearchPageState extends State<MeaningSearchPage> {
  final _controller = TextEditingController();
  List<Match> _matches = const [];
  bool _searched = false;
  bool _thinking = false;
  int _indexed = 0;
  int _pending = 0;
  int _caughtUp = 0;

  @override
  void initState() {
    super.initState();
    _catchUp();
  }

  /// Indexes anything written before this feature existed, or missed by a
  /// failed embedding. Done when the search page opens rather than on every
  /// launch: it is only here that an unindexed note actually costs anything,
  /// and starting a model on every cold start to catch up would be a strange
  /// way to spend someone's battery.
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

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Deliberately on submit rather than on every keystroke. Embedding a query
  /// runs a model; doing it per character would heat the phone to answer
  /// questions nobody asked.
  Future<void> _search() async {
    final query = _controller.text.trim();
    if (query.isEmpty || _thinking) return;

    setState(() => _thinking = true);
    final indexed = await widget.database.countEmbeddings();
    final embedder = await JournalEmbedder.load();
    final matches =
        await MeaningSearch(widget.database, embedder).search(query);

    if (!mounted) return;
    setState(() {
      _matches = matches;
      _indexed = indexed;
      _searched = true;
      _thinking = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: TextField(
          key: MeaningSearchKeys.field,
          controller: _controller,
          autofocus: true,
          textInputAction: TextInputAction.search,
          onSubmitted: (_) => _search(),
          decoration: const InputDecoration(
            hintText: 'What were you thinking about?',
            border: InputBorder.none,
          ),
        ),
        actions: [
          IconButton(
            key: MeaningSearchKeys.submit,
            icon: const Icon(Icons.search),
            onPressed: _thinking ? null : _search,
          ),
        ],
      ),
      body: Builder(
        builder: (context) {
          if (_thinking) {
            return const Center(
              key: MeaningSearchKeys.thinking,
              child: CircularProgressIndicator(),
            );
          }
          if (_pending > 0) {
            return Center(
              key: MeaningSearchKeys.catchingUp,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const CircularProgressIndicator(),
                  const SizedBox(height: 16),
                  Text(
                    'Catching up on older notes ($_caughtUp of $_pending)',
                    style: theme.textTheme.bodyMedium,
                  ),
                ],
              ),
            );
          }
          if (!_searched) return const SizedBox.shrink();
          if (_matches.isEmpty && _indexed == 0) {
            // A different situation from "nothing matched", and saying so
            // stops someone concluding the search is broken when their
            // journal simply has not been indexed.
            return Center(
              key: MeaningSearchKeys.nothingIndexed,
              child: Text(
                'Nothing has been indexed yet.',
                style: theme.textTheme.bodyLarge,
              ),
            );
          }
          if (_matches.isEmpty) {
            return Center(
              key: MeaningSearchKeys.nothingFound,
              child: Text(
                'Nothing close enough to that.',
                style: theme.textTheme.bodyLarge,
              ),
            );
          }

          return ListView.separated(
            key: MeaningSearchKeys.results,
            padding: const EdgeInsets.all(16),
            itemCount: _matches.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final match = _matches[index];
              final day = parseDayId(match.note.dayId);
              return Card(
                margin: EdgeInsets.zero,
                child: ListTile(
                  title: Text(match.note.content),
                  subtitle: Text(formatDayLabel(day)),
                  onTap: () => Navigator.of(context).pop(day),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
