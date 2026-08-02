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

  /// 0 while the note exists; the moment it was deleted otherwise. A deleted
  /// row survives only as a tombstone so a restore cannot resurrect it — its
  /// content is erased at the same time (ADR-0007).
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

@DriftDatabase(tables: [Notes, Settings])
class JournalDatabase extends _$JournalDatabase {
  JournalDatabase(super.executor);

  @override
  int get schemaVersion => 3;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onUpgrade: (m, from, to) async {
          if (from < 2) await m.addColumn(notes, notes.deletedAt);
          if (from < 3) await m.createTable(settings);
        },
      );

  /// Tombstones are filtered here rather than at each call site: forgetting the
  /// filter shows an empty note instead of no note, which is a quiet kind of
  /// wrong (ADR-0007).
  Future<List<Note>> notesForDay(String dayId) => (select(notes)
        ..where((n) => n.dayId.equals(dayId) & n.deletedAt.equals(0)))
      .get();

  Future<void> addNote(NotesCompanion note) => into(notes).insert(note);

  Future<String?> setting(String name) async {
    final row = await (select(settings)..where((s) => s.name.equals(name)))
        .getSingleOrNull();
    return row?.value;
  }

  Future<void> putSetting(String name, String value) =>
      into(settings).insertOnConflictUpdate(
        SettingsCompanion(name: Value(name), value: Value(value)),
      );

  /// A plain case-insensitive substring match, newest first. Deliberately not
  /// full-text search: FTS needs its own index kept in step with the table, and
  /// nothing yet suggests the journal is large enough to need it.
  ///
  /// Written as raw SQL for the `ESCAPE` clause: without it a search for "50%"
  /// or "_" would be read as a wildcard and quietly match everything.
  Future<List<Note>> searchNotes(String query) async {
    final escaped = query
        .replaceAll(r'\', r'\\')
        .replaceAll('%', r'\%')
        .replaceAll('_', r'\_');

    final rows = await customSelect(
      "SELECT * FROM notes WHERE deleted_at = 0 "
      r"AND content LIKE ?1 ESCAPE '\' "
      'ORDER BY created_at DESC',
      variables: [Variable<String>('%$escaped%')],
      readsFrom: {notes},
    ).get();

    return rows.map((row) => notes.map(row.data)).toList();
  }

  Future<void> rewordNote(String id, String content) =>
      (update(notes)..where((n) => n.id.equals(id)))
          .write(NotesCompanion(content: Value(content)));

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
