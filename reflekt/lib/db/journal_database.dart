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

  @override
  Set<Column> get primaryKey => {id};
}

@DriftDatabase(tables: [Notes])
class JournalDatabase extends _$JournalDatabase {
  JournalDatabase(super.executor);

  @override
  int get schemaVersion => 1;

  Future<List<Note>> notesForDay(String dayId) =>
      (select(notes)..where((n) => n.dayId.equals(dayId))).get();

  Future<void> addNote(NotesCompanion note) => into(notes).insert(note);
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
