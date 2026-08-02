import 'package:flutter/material.dart';

import '../../core/day_id.dart';
import '../../db/journal_database.dart';
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
