import 'package:drift/drift.dart' show Value, Variable;

import '../../core/clock.dart';
import '../../core/day_id.dart';
import '../../db/journal_database.dart';
import '../memory/journal_embedder.dart';
import '../memory/meaning_search.dart';
import 'journal_tool.dart';

/// What the assistant may do to a journal.
///
/// Every one of these goes through the same database calls a person's own
/// tapping does. A note the assistant wrote is an ordinary note — editable,
/// deletable, indexed the same way — because treating it as a special kind
/// would make it harder to correct, which is exactly backwards.
List<JournalTool> journalTools({
  required JournalDatabase database,
  required DateTime day,
  Clock clock = systemClock,
  required Future<void> Function(String noteId, String content) remember,
}) =>
    [
      _SearchJournalMemory(database),
      _ReadNotes(database, day),
      _WriteNote(database, clock, remember),
      _UpdateNote(database, remember),
      _DeleteNote(database, clock),
    ];

/// Reaching other days.
///
/// This is what replaces sending a slice of the journal with every question:
/// the assistant asks for what it needs, when it decides it needs it, rather
/// than being handed a guess up front.
class _SearchJournalMemory implements JournalTool {
  const _SearchJournalMemory(this._database);

  final JournalDatabase _database;

  @override
  String get name => 'search_journal_memory';

  @override
  String get purpose =>
      'Search everything the person has written, by meaning rather than by '
      'exact words. Use it when the answer might be in an entry you have not '
      'been shown.';

  @override
  Map<String, dynamic> get parameters => const {
        'type': 'object',
        'properties': {
          'query': {
            'type': 'string',
            'description': 'What to look for, in plain language.',
          },
        },
        'required': ['query'],
      };

  @override
  Future<String> run(Map<String, dynamic> arguments) async {
    final query = arguments['query'] as String? ?? '';
    if (query.trim().isEmpty) return 'A search needs something to look for.';

    final embedder = await JournalEmbedder.load();
    final found = await MeaningSearch(_database, embedder).search(query);

    if (found.isEmpty) {
      // Said plainly, so the model reports an empty journal rather than
      // filling the silence with something plausible.
      return 'Nothing written matches that.';
    }

    // Labelled by how it was written: "said" and "wrote" are different kinds
    // of evidence about a day, and flattening them would let the assistant
    // quote a passing remark back as something the person had set down.
    return found
        .map((match) =>
            '${formatDayLabel(parseDayId(match.entry.dayId))} '
            '(${match.entry.kind == IndexedKind.message ? 'said' : 'wrote'}): '
            '${match.entry.content}')
        .join('\n');
  }
}

/// Reading a day.
class _ReadNotes implements JournalTool {
  const _ReadNotes(this._database, this._openDay);

  final JournalDatabase _database;

  /// The day being read on screen. What "today" means to this conversation.
  final DateTime _openDay;

  @override
  String get name => 'read_notes';

  @override
  String get purpose =>
      'Read the notes written on one day. Defaults to the day being looked at. '
      'Call this before changing or deleting a note, so you are working from '
      'what is actually there.';

  @override
  Map<String, dynamic> get parameters => const {
        'type': 'object',
        'properties': {
          'day': {
            'type': 'string',
            'description': 'The day to read, as YYYY-MM-DD. Omit for the day '
                'being looked at.',
          },
        },
      };

  @override
  Future<String> run(Map<String, dynamic> arguments) async {
    final asked = arguments['day'] as String?;
    final dayId = asked == null || asked.trim().isEmpty
        ? dayIdOf(_openDay)
        : asked.trim();

    final notes = await _database.notesForDay(dayId);
    if (notes.isEmpty) return 'Nothing was written on $dayId.';

    // Ids are included because changing or deleting a note needs one, and
    // making the model guess at that is how the wrong note gets erased.
    return notes
        .map((note) => '[${note.id}] ${note.content}'
            '${note.category.isEmpty ? '' : ' (${note.category})'}')
        .join('\n');
  }
}

/// Writing something down, when asked to.
class _WriteNote implements JournalTool {
  const _WriteNote(this._database, this._clock, this._remember);

  final JournalDatabase _database;
  final Clock _clock;
  final Future<void> Function(String noteId, String content) _remember;

  @override
  String get name => 'write_note';

  @override
  String get purpose =>
      'Write a new note into the journal. Only when the person asks you to '
      'save, note or write something down. Answering a question is never a '
      'reason to record anything.';

  @override
  Map<String, dynamic> get parameters => const {
        'type': 'object',
        'properties': {
          'content': {
            'type': 'string',
            'description': 'What the note should say, in the person\'s own '
                'words where possible.',
          },
          'category': {
            'type': 'string',
            'description': 'One of personal, health, dream, insight. Omit if '
                'none of them fits.',
          },
        },
        'required': ['content'],
      };

  @override
  Future<String> run(Map<String, dynamic> arguments) async {
    final content = (arguments['content'] as String? ?? '').trim();
    if (content.isEmpty) return 'A note needs something in it.';

    // Onto the day it is being written, which is not necessarily the day being
    // read — the same rule a person's own note follows.
    final now = _clock();
    final id = now.microsecondsSinceEpoch.toString();

    await _database.addNote(
      NotesCompanion(
        id: Value(id),
        dayId: Value(dayIdOf(now)),
        content: Value(content),
        category: Value((arguments['category'] as String? ?? '').trim()),
        createdAt: Value(now.millisecondsSinceEpoch),
      ),
    );
    await _remember(id, content);

    return 'Written down, on ${formatDayLabel(now)}.';
  }
}

/// Changing a note that already exists.
class _UpdateNote implements JournalTool {
  const _UpdateNote(this._database, this._remember);

  final JournalDatabase _database;
  final Future<void> Function(String noteId, String content) _remember;

  @override
  String get name => 'update_note';

  @override
  String get purpose =>
      'Change what an existing note says. Read the day first to get the note '
      'id — the wrong id rewrites a different note.';

  @override
  Map<String, dynamic> get parameters => const {
        'type': 'object',
        'properties': {
          'note_id': {
            'type': 'string',
            'description': 'The id shown in square brackets by read_notes.',
          },
          'content': {
            'type': 'string',
            'description': 'What the note should now say.',
          },
        },
        'required': ['note_id', 'content'],
      };

  @override
  Future<String> run(Map<String, dynamic> arguments) async {
    final id = (arguments['note_id'] as String? ?? '').trim();
    final content = (arguments['content'] as String? ?? '').trim();
    if (id.isEmpty) return 'Changing a note needs its id.';
    if (content.isEmpty) return 'A note needs something in it.';

    // Refused rather than silently creating one. An update against an id that
    // does not exist means the model is working from something it invented,
    // and writing anyway would hide that.
    if (!await _exists(id)) {
      return 'There is no note with id $id. Read the day again.';
    }

    await _database.rewordNote(id, content);
    // Re-embedded, or the index keeps finding this note by what it used to
    // say — with the new text displayed, which looks like a working search
    // returning the wrong thing.
    await _remember(id, content);

    return 'Changed.';
  }

  Future<bool> _exists(String id) async {
    final rows = await _database.customSelect(
      'SELECT 1 FROM notes WHERE id = ?1 AND deleted_at = 0',
      variables: [Variable<String>(id)],
    ).get();
    return rows.isNotEmpty;
  }
}

/// Erasing a note.
///
/// The only thing here that cannot be undone: the text is erased and only a
/// tombstone survives (ADR-0007). The model chooses the target, not the
/// person, so the id is required and never guessed at — and a miss is refused
/// rather than applied to whatever is nearest.
class _DeleteNote implements JournalTool {
  const _DeleteNote(this._database, this._clock);

  final JournalDatabase _database;
  final Clock _clock;

  @override
  String get name => 'delete_note';

  @override
  String get purpose =>
      'Erase a note for good. This cannot be undone, so only when the person '
      'has clearly asked for that note to go. Read the day first to get the '
      'id, and say which note you are erasing before you do it.';

  @override
  Map<String, dynamic> get parameters => const {
        'type': 'object',
        'properties': {
          'note_id': {
            'type': 'string',
            'description': 'The id shown in square brackets by read_notes.',
          },
        },
        'required': ['note_id'],
      };

  @override
  Future<String> run(Map<String, dynamic> arguments) async {
    final id = (arguments['note_id'] as String? ?? '').trim();
    if (id.isEmpty) return 'Erasing a note needs its id.';

    final rows = await _database.customSelect(
      'SELECT content FROM notes WHERE id = ?1 AND deleted_at = 0',
      variables: [Variable<String>(id)],
    ).get();
    if (rows.isEmpty) {
      return 'There is no note with id $id. Nothing was erased.';
    }

    await _database.deleteNote(id, _clock());
    // Erasing the text but leaving its vector would let a deleted note keep
    // surfacing in meaning search (ADR-0007).
    await _database.removeEmbedding(id);

    // Quoted back so the person reading the conversation can see exactly what
    // went, rather than being told something was erased.
    return 'Erased: "${rows.single.data['content']}"';
  }
}
