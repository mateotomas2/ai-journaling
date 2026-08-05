import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

part 'journal_database.g.dart';

/// Notes as stored. Mirrors the domain `Note`; see `../CONTEXT.md`.
class Notes extends Table {
  TextColumn get id => text()();

  /// `YYYY-MM-DD`, the day this note belongs to.
  TextColumn get dayId => text()();
  TextColumn get content => text()();
  IntColumn get createdAt => integer()();

  /// What the note is about. Empty when uncategorised, which is a first-class
  /// state: making someone classify a thought before writing it down is a good
  /// way to stop them writing it down.
  TextColumn get category => text().withDefault(const Constant(''))();

  /// 0 while the note exists; the moment it was deleted otherwise. A deleted
  /// row survives only as a tombstone so a restore cannot resurrect it — its
  /// content is erased at the same time (ADR-0007).
  IntColumn get deletedAt => integer().withDefault(const Constant(0))();

  @override
  Set<Column> get primaryKey => {id};
}

/// Who said something. Stored as the enum's name, so the column stays readable
/// and a value written by a newer version does not become a number nobody can
/// interpret.
enum MessageRole { user, assistant }

/// A day's conversation, as stored.
///
/// A message is not a lesser kind of note. It belongs to a day the same way,
/// survives a lock the same way, and is erased the same way — the difference is
/// only that it was said rather than written down (see `../../CONTEXT.md`).
class Messages extends Table {
  TextColumn get id => text()();

  /// `YYYY-MM-DD`, the day this was said on.
  TextColumn get dayId => text()();

  /// A [MessageRole] name. Which side said it decides almost everything that
  /// happens to it afterwards — most importantly whether it is indexed at all
  /// (ADR-0010).
  TextColumn get role => text()();
  TextColumn get content => text()();
  IntColumn get createdAt => integer()();

  /// 0 while the message exists; the moment it was deleted otherwise, with its
  /// text erased at the same time (ADR-0007).
  IntColumn get deletedAt => integer().withDefault(const Constant(0))();

  @override
  Set<Column> get primaryKey => {id};
}

/// Small pieces of configuration that belong to this journal.
///
/// Kept in the encrypted database rather than in the Keystore or shared
/// preferences, so an API key is readable only while the journal is unlocked.
/// A key that outlives the lock would be a way to spend the owner's money
/// without their password.
class Settings extends Table {
  TextColumn get name => text()();
  TextColumn get value => text()();

  @override
  Set<Column> get primaryKey => {name};
}

/// What an indexed vector belongs to.
///
/// Ids are minted from the clock, so a note and a message can genuinely share
/// one. Keyed by id alone, the second thing indexed in a given microsecond
/// would silently overwrite the first.
enum IndexedKind { note, message }

/// The meaning of something written, as a vector.
///
/// Kept beside what it describes rather than derived on the fly: embedding 384
/// numbers takes long enough that doing it on every search would make searching
/// feel broken.
class Embeddings extends Table {
  /// An [IndexedKind] name.
  TextColumn get entityType => text()();

  /// The id of the note or message this vector is of.
  TextColumn get entityId => text()();

  /// 384 float32s, raw. Storing them as text would cost several kilobytes
  /// each, and the journal is encrypted, so every byte is paid for twice.
  BlobColumn get vector => blob()();

  @override
  Set<Column> get primaryKey => {entityType, entityId};
}

@DriftDatabase(tables: [Notes, Messages, Settings, Embeddings])
class JournalDatabase extends _$JournalDatabase {
  JournalDatabase(super.executor);

  @override
  int get schemaVersion => 6;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onUpgrade: (m, from, to) async {
          if (from < 2) await m.addColumn(notes, notes.deletedAt);
          if (from < 3) await m.createTable(settings);
          if (from < 4) await m.addColumn(notes, notes.category);
          // Embeddings claimed 4 on this branch while master claimed it for
          // category. Renumbered to 5 on merge: two migrations sharing a
          // version means one of them never runs on an existing journal.
          if (from < 5) await m.createTable(embeddings);
          if (from < 6) {
            await m.createTable(messages);
            // The index is derived, so it is thrown away and rebuilt rather
            // than migrated column by column. Losing it costs a re-embed —
            // which `IndexBackfill` already does lazily — and nothing a person
            // wrote is in here to lose.
            await m.deleteTable('embeddings');
            await m.createTable(embeddings);
          }
        },
      );

  /// Tombstones are filtered here rather than at each call site: forgetting the
  /// filter shows an empty note instead of no note, which is a quiet kind of
  /// wrong (ADR-0007).
  Future<List<Note>> notesForDay(String dayId) => (select(notes)
        ..where((n) => n.dayId.equals(dayId) & n.deletedAt.equals(0)))
      .get();

  Future<void> addNote(NotesCompanion note) => into(notes).insert(note);

  /// Every surviving note, oldest first — the context an AI question is
  /// answered from. Tombstones are excluded: a deleted note must not come back
  /// through a side door (ADR-0007).
  Future<List<String>> allNoteContents() async {
    final rows = await (select(notes)
          ..where((n) => n.deletedAt.equals(0))
          ..orderBy([(n) => OrderingTerm.asc(n.createdAt)]))
        .get();
    return rows.map((n) => n.content).toList();
  }

  /// The conversation that happened on a day, oldest first, as it was said.
  /// Tombstones are filtered here rather than at each call site (ADR-0007).
  Future<List<Message>> messagesForDay(String dayId) => (select(messages)
        ..where((m) => m.dayId.equals(dayId) & m.deletedAt.equals(0))
        ..orderBy([(m) => OrderingTerm.asc(m.createdAt)]))
      .get();

  Future<void> addMessage(MessagesCompanion message) =>
      into(messages).insert(message);

  /// Erases what was said and leaves the tombstone, in one write so there is no
  /// moment where the message is deleted but still readable.
  Future<void> deleteMessage(String id, DateTime at) =>
      (update(messages)..where((m) => m.id.equals(id))).write(
        MessagesCompanion(
          content: const Value(''),
          deletedAt: Value(at.millisecondsSinceEpoch),
        ),
      );

  /// The messages that belong in the meaning index: the person's own, and only
  /// those (ADR-0010). An assistant reply is largely a restatement of the
  /// entries it was built from, so indexing it would rank the machine
  /// paraphrasing you above the thing you actually wrote.
  Future<List<Message>> messagesToIndex() => (select(messages)
        ..where((m) =>
            m.deletedAt.equals(0) & m.role.equals(MessageRole.user.name))
        ..orderBy([(m) => OrderingTerm.asc(m.createdAt)]))
      .get();

  Future<void> putEmbeddingFor(
    IndexedKind kind,
    String entityId,
    Uint8List vector,
  ) =>
      into(embeddings).insertOnConflictUpdate(
        EmbeddingsCompanion(
          entityType: Value(kind.name),
          entityId: Value(entityId),
          vector: Value(vector),
        ),
      );

  /// Indexes a note. Kept as its own name because most callers only ever deal
  /// in notes, and `putEmbeddingFor(IndexedKind.note, …)` at every one of them
  /// is ceremony rather than clarity.
  Future<void> putEmbedding(String noteId, Uint8List vector) =>
      putEmbeddingFor(IndexedKind.note, noteId, vector);

  /// How many notes have been indexed. Distinguishes "nothing matched" from
  /// "nothing has been indexed yet", which look identical from the outside and
  /// mean very different things.
  Future<int> countEmbeddings() async {
    final row = await customSelect(
      'SELECT COUNT(*) AS c FROM embeddings',
      readsFrom: {embeddings},
    ).getSingle();
    return row.data['c'] as int;
  }

  Future<void> removeEmbeddingFor(IndexedKind kind, String entityId) =>
      (delete(embeddings)
            ..where((e) =>
                e.entityType.equals(kind.name) & e.entityId.equals(entityId)))
          .go();

  Future<void> removeEmbedding(String noteId) =>
      removeEmbeddingFor(IndexedKind.note, noteId);

  /// Every note that has a vector, with it. Tombstones are excluded by the
  /// join, so a deleted note cannot come back through a search (ADR-0007).
  ///
  /// The join is on kind *and* id: a message indexed under the same id is a
  /// different thing entirely, and matching it here would attach someone's
  /// question to a note that never had a vector.
  Future<List<(Note, Uint8List)>> notesWithEmbeddings() async {
    final query = select(notes).join([
      innerJoin(
        embeddings,
        embeddings.entityId.equalsExp(notes.id) &
            embeddings.entityType.equals(IndexedKind.note.name),
      ),
    ])
      ..where(notes.deletedAt.equals(0));

    final rows = await query.get();
    return [
      for (final row in rows)
        (row.readTable(notes), row.readTable(embeddings).vector),
    ];
  }

  /// Notes that have never been embedded — what a backfill works through.
  Future<List<Note>> notesWithoutEmbeddings() async {
    final query = select(notes).join([
      leftOuterJoin(
        embeddings,
        embeddings.entityId.equalsExp(notes.id) &
            embeddings.entityType.equals(IndexedKind.note.name),
      ),
    ])
      ..where(notes.deletedAt.equals(0) & embeddings.entityId.isNull());

    final rows = await query.get();
    return [for (final row in rows) row.readTable(notes)];
  }

  /// Every indexed message, with its vector. Only the person's own, and only
  /// those still standing (ADR-0010).
  Future<List<(Message, Uint8List)>> messagesWithEmbeddings() async {
    final query = select(messages).join([
      innerJoin(
        embeddings,
        embeddings.entityId.equalsExp(messages.id) &
            embeddings.entityType.equals(IndexedKind.message.name),
      ),
    ])
      ..where(messages.deletedAt.equals(0) &
          messages.role.equals(MessageRole.user.name));

    final rows = await query.get();
    return [
      for (final row in rows)
        (row.readTable(messages), row.readTable(embeddings).vector),
    ];
  }

  /// The person's messages that have never been embedded.
  Future<List<Message>> messagesWithoutEmbeddings() async {
    final query = select(messages).join([
      leftOuterJoin(
        embeddings,
        embeddings.entityId.equalsExp(messages.id) &
            embeddings.entityType.equals(IndexedKind.message.name),
      ),
    ])
      ..where(messages.deletedAt.equals(0) &
          messages.role.equals(MessageRole.user.name) &
          embeddings.entityId.isNull());

    final rows = await query.get();
    return [for (final row in rows) row.readTable(messages)];
  }

  /// Everything still standing, for an export. Tombstones are left out: a
  /// deletion is meant to be final (ADR-0007), and writing erased rows into a
  /// file someone might re-import would work against that.
  Future<List<Note>> allLivingNotes() => (select(notes)
        ..where((n) => n.deletedAt.equals(0))
        ..orderBy([(n) => OrderingTerm.asc(n.createdAt)]))
      .get();

  Future<List<Message>> allLivingMessages() => (select(messages)
        ..where((m) => m.deletedAt.equals(0))
        ..orderBy([(m) => OrderingTerm.asc(m.createdAt)]))
      .get();

  Future<List<Setting>> allSettings() => select(settings).get();

  /// Writes a note that may already exist, as an import does.
  Future<void> putNote(NotesCompanion note) =>
      into(notes).insertOnConflictUpdate(note);

  Future<void> putMessage(MessagesCompanion message) =>
      into(messages).insertOnConflictUpdate(message);

  /// Every category this journal actually uses, most-used first.
  ///
  /// Offered before a blank field, so reaching for a word already in the
  /// journal is easier than coining a new one — which is the only thing
  /// holding the vocabulary together now that it is free text (ADR-0012).
  Future<List<String>> knownCategories() async {
    final rows = await customSelect(
      'SELECT category, COUNT(*) AS uses FROM notes '
      "WHERE deleted_at = 0 AND category != '' "
      'GROUP BY category ORDER BY uses DESC, category ASC',
      readsFrom: {notes},
    ).get();
    return [for (final row in rows) row.data['category'] as String];
  }

  Future<String?> setting(String name) async {
    final row = await (select(settings)..where((s) => s.name.equals(name)))
        .getSingleOrNull();
    return row?.value;
  }

  Future<void> putSetting(String name, String value) =>
      into(settings).insertOnConflictUpdate(
        SettingsCompanion(name: Value(name), value: Value(value)),
      );

  /// Makes a search term mean itself.
  ///
  /// Without this a search for "50%" or "_" is read as a wildcard and quietly
  /// matches everything — which looks like a broken search returning the whole
  /// journal. Shared by both searches rather than written twice: the copy is
  /// exactly the kind of thing that gets dropped, and the failure is silent.
  static String _literally(String query) => query
      .replaceAll(r'\', r'\\')
      .replaceAll('%', r'\%')
      .replaceAll('_', r'\_');

  /// A plain case-insensitive substring match, newest first. Deliberately not
  /// full-text search: FTS needs its own index kept in step with the table, and
  /// nothing yet suggests the journal is large enough to need it.
  ///
  /// Written as raw SQL for the `ESCAPE` clause, which drift's query builder
  /// has no expression for.
  Future<List<Note>> searchNotes(String query) async {
    final rows = await customSelect(
      "SELECT * FROM notes WHERE deleted_at = 0 "
      r"AND content LIKE ?1 ESCAPE '\' "
      'ORDER BY created_at DESC',
      variables: [Variable<String>('%${_literally(query)}%')],
      readsFrom: {notes},
    ).get();

    return rows.map((row) => notes.map(row.data)).toList();
  }

  /// The same match over what was said.
  ///
  /// Both sides of the conversation are searchable by text, including the
  /// assistant's — text search is how you reach a reply at all, since the
  /// meaning index deliberately does not hold one (ADR-0010).
  Future<List<Message>> searchMessages(String query) async {
    final rows = await customSelect(
      'SELECT * FROM messages WHERE deleted_at = 0 '
      r"AND content LIKE ?1 ESCAPE '\' "
      'ORDER BY created_at DESC',
      variables: [Variable<String>('%${_literally(query)}%')],
      readsFrom: {messages},
    ).get();

    return rows.map((row) => messages.map(row.data)).toList();
  }

  Future<void> rewordNote(String id, String content, {String? category}) =>
      (update(notes)..where((n) => n.id.equals(id))).write(
        NotesCompanion(
          content: Value(content),
          category: category == null ? const Value.absent() : Value(category),
        ),
      );

  /// Erases the writing and leaves the tombstone, in one write so there is no
  /// moment where the note is deleted but its text is still readable.
  Future<void> deleteNote(String id, DateTime at) =>
      (update(notes)..where((n) => n.id.equals(id))).write(
        NotesCompanion(
          content: const Value(''),
          deletedAt: Value(at.millisecondsSinceEpoch),
        ),
      );
}

/// Re-encrypts the database with a new key.
///
/// SQLCipher rewrites every page, so this is not a metadata change — it is the
/// whole journal, and being interrupted part-way is the risk worth designing
/// around.
///
/// `PRAGMA rekey` does that rewrite in a transaction: it either completes and
/// the file opens with the new key, or it does not and the file still opens
/// with the old one. There is no state where neither works, which is the only
/// outcome that would actually lose someone their journal.
///
/// The salt is therefore written **after** the rekey succeeds. Writing it first
/// would point the app at a key the file does not use, which looks exactly like
/// a forgotten password.
Future<void> rekeyJournal({
  required JournalDatabase database,
  required String newRawKey,
}) async {
  await database.customStatement('PRAGMA rekey = "x\'$newRawKey\'";');
}

/// Thrown when the database will not open with the key it was given, which in
/// practice means the password was wrong.
class WrongPasswordException implements Exception {
  const WrongPasswordException();
  @override
  String toString() => 'WrongPasswordException';
}

/// Opens the encrypted journal database.
///
/// [rawKey] is 64 hex characters from [JournalKey.derive].
Future<JournalDatabase> openJournalDatabase({
  required String rawKey,
  String? overrideDirectory,
}) async {
  final dir = overrideDirectory ??
      (await getApplicationDocumentsDirectory()).path;
  final file = File(p.join(dir, 'journal.sqlite'));

  final executor = NativeDatabase.createInBackground(
    file,
    setup: (db) {
      // Must run before anything touches the database, including the schema
      // check drift performs on open.
      db.execute("PRAGMA key = \"x'$rawKey'\";");
      // Reading a page is what actually proves the key: SQLCipher accepts any
      // key at PRAGMA time and only fails when it cannot decrypt.
      db.execute('SELECT count(*) FROM sqlite_master;');
    },
  );

  final database = JournalDatabase(executor);
  try {
    // Force the connection open now, so a wrong password surfaces here rather
    // than on some later unrelated query.
    await database.customSelect('SELECT 1').get();
  } catch (error) {
    try {
      await database.close();
    } catch (_) {
      // Closing a database that never opened can fail; the original error is
      // the interesting one.
    }

    // SQLCipher cannot tell a wrong key from a corrupt file, so both arrive as
    // `SqliteException(26): file is not a database`. Matched on the message
    // rather than the type because `createInBackground` runs the open in
    // another isolate, and the exception is wrapped by the time it gets here —
    // `on SqliteException` silently never matches.
    if (error.toString().contains('file is not a database')) {
      throw const WrongPasswordException();
    }
    rethrow;
  }
  return database;
}

/// Which SQLite build is loaded is decided in `pubspec.yaml`:
///
/// ```yaml
/// hooks:
///   user_defines:
///     sqlite3:
///       source: sqlcipher
/// ```
///
/// This matters more than it looks. Stock SQLite *accepts* `PRAGMA key` and
/// ignores it, so getting this wrong does not fail — it just writes the journal
/// in the clear. The old `sqlcipher_flutter_libs` package is a no-op since
/// `package:sqlite3` 3.x and does nothing if added.
///
/// Verified by `test/encryption_test.dart`, which asserts the file on disk is
/// not a readable SQLite database.
const sqlCipherIsSelectedInPubspec = true;
