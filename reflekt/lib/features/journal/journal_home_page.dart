import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';

import '../../core/day_id.dart';
import '../../db/journal_database.dart';
import '../lock/journal_session.dart';
import 'note_composer_page.dart';

/// Keys the specs drive. Keep these stable — renaming one breaks a recording.
class JournalHomeKeys {
  static const emptyState = Key('journal_empty_state');
  static const addNote = Key('journal_add_note');
  static const noteList = Key('journal_note_list');
}

/// Today's journal, read from the encrypted database.
class JournalHomePage extends StatefulWidget {
  const JournalHomePage({super.key, required this.session});

  final JournalSession session;

  @override
  State<JournalHomePage> createState() => _JournalHomePageState();
}

class _JournalHomePageState extends State<JournalHomePage> {
  late Future<List<Note>> _notes;
  final _today = DateTime.now();

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _notes = widget.session.database.notesForDay(dayIdOf(_today));
  }

  Future<void> _composeNote() async {
    final text = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const NoteComposerPage()),
    );
    if (text == null || text.isEmpty) return;

    final now = DateTime.now();
    await widget.session.database.addNote(
      NotesCompanion(
        id: Value(now.microsecondsSinceEpoch.toString()),
        dayId: Value(dayIdOf(now)),
        content: Value(text),
        createdAt: Value(now.millisecondsSinceEpoch),
      ),
    );
    if (!mounted) return;
    setState(_load);
  }

  @override
  Widget build(BuildContext context) {
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
                formatDayLabel(_today),
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
      body: FutureBuilder<List<Note>>(
        future: _notes,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final notes = snapshot.data!;
          if (notes.isEmpty) return const _EmptyState();
          return _NoteList(notes: notes.reversed.toList());
        },
      ),
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
