import 'package:flutter/material.dart';

import '../../core/day_id.dart';
import '../../db/journal_database.dart';

/// Keys the specs drive. Keep these stable — renaming one breaks a recording.
class SearchKeys {
  static const field = Key('search_field');
  static const results = Key('search_results');
  static const nothingFound = Key('search_nothing_found');
}

/// Finds notes across every day.
///
/// Pops with the day a chosen result belongs to: a result you cannot get back
/// to is half an answer, and the surrounding entries are usually the reason you
/// were looking.
class SearchPage extends StatefulWidget {
  const SearchPage({super.key, required this.database});

  final JournalDatabase database;

  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final _controller = TextEditingController();
  List<Note> _results = const [];
  bool _searched = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_search);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    final query = _controller.text.trim();
    if (query.isEmpty) {
      setState(() {
        _results = const [];
        _searched = false;
      });
      return;
    }

    final found = await widget.database.searchNotes(query);
    if (!mounted) return;
    setState(() {
      _results = found;
      _searched = true;
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
          decoration: const InputDecoration(
            hintText: 'Search your journal',
            border: InputBorder.none,
          ),
        ),
      ),
      body: switch ((_searched, _results.isEmpty)) {
        (false, _) => const SizedBox.shrink(),
        (true, true) => Center(
            key: SearchKeys.nothingFound,
            child: Text(
              'Nothing matches that.',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
          ),
        (true, false) => ListView.separated(
            key: SearchKeys.results,
            padding: const EdgeInsets.all(16),
            itemCount: _results.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final note = _results[index];
              final day = parseDayId(note.dayId);
              return Card(
                margin: EdgeInsets.zero,
                child: ListTile(
                  title: Text(note.content),
                  subtitle: Text(formatDayLabel(day)),
                  onTap: () => Navigator.of(context).pop(day),
                ),
              );
            },
          ),
      },
    );
  }
}
