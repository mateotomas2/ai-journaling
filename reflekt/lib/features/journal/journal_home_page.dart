import 'package:flutter/material.dart';

import '../../core/day_id.dart';
import 'note.dart';
import 'note_composer_page.dart';

/// Keys the evidence test drives. Keep these stable — renaming one breaks the
/// happy-flow recording.
class JournalHomeKeys {
  static const emptyState = Key('journal_empty_state');
  static const addNote = Key('journal_add_note');
  static const noteList = Key('journal_note_list');
}

/// Today's journal. Notes live in memory only until persistence lands
/// (ADR-0002) — restarting the app clears them.
class JournalHomePage extends StatefulWidget {
  const JournalHomePage({super.key});

  @override
  State<JournalHomePage> createState() => _JournalHomePageState();
}

class _JournalHomePageState extends State<JournalHomePage> {
  final _notes = <Note>[];

  Future<void> _composeNote() async {
    final text = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const NoteComposerPage()),
    );
    if (text == null || text.isEmpty) return;

    final now = DateTime.now();
    setState(() {
      _notes.insert(
        0,
        Note(
          id: now.microsecondsSinceEpoch.toString(),
          dayId: dayIdOf(now),
          content: text,
          createdAt: now,
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Reflekt'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(28),
          child: Padding(
            padding: const EdgeInsets.only(left: 16, bottom: 12),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                formatDayLabel(today),
                style: Theme.of(context).textTheme.bodyMedium,
              ),
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
      body: _notes.isEmpty ? const _EmptyState() : _NoteList(notes: _notes),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      key: JournalHomeKeys.emptyState,
      child: Text(
        'Nothing written today yet.',
        style: Theme.of(context).textTheme.bodyLarge,
      ),
    );
  }
}

class _NoteList extends StatelessWidget {
  const _NoteList({required this.notes});

  final List<Note> notes;

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
            title: Text(note.content),
            subtitle: Text(formatTimeLabel(note.createdAt)),
          ),
        );
      },
    );
  }
}
