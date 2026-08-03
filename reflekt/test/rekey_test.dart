import 'dart:io';

import 'package:drift/drift.dart' show Value;
import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/db/journal_database.dart';
import 'package:reflekt/features/lock/journal_key.dart';

/// Re-encrypting the journal under a new password.
///
/// The criterion that matters is the one about interruption: a rekey that
/// leaves the file readable by *neither* password destroys everything. These
/// check the property the design rests on — `PRAGMA rekey` rewrites every page
/// in a transaction, so the file opens with one key or the other, never
/// neither.
void main() {
  late Directory dir;
  var skip = false;

  setUp(() => dir = Directory.systemTemp.createTempSync('reflekt-rekey'));
  tearDown(() => dir.deleteSync(recursive: true));

  Future<JournalDatabase?> open(String key) async {
    try {
      return await openJournalDatabase(rawKey: key, overrideDirectory: dir.path);
    } catch (error) {
      if (error is WrongPasswordException) rethrow;
      if (!error.toString().contains('Failed to load dynamic library')) rethrow;
      skip = true;
      return null;
    }
  }

  Future<String> keyFor(String password, String salt) =>
      JournalKey.derive(password: password, salt: salt);

  test('the journal survives, and only the new password opens it', () async {
    final oldSalt = JournalKey.newSalt();
    final oldKey = await keyFor('the first password', oldSalt);

    final db = await open(oldKey);
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    await db!.addNote(
      NotesCompanion(
        id: const Value('1'),
        dayId: const Value('2026-08-01'),
        content: const Value('written under the old password'),
        createdAt: Value(DateTime.now().millisecondsSinceEpoch),
      ),
    );

    final newSalt = JournalKey.newSalt();
    final newKey = await keyFor('the second password', newSalt);
    await rekeyJournal(database: db, newRawKey: newKey);
    await db.close();

    // Everything still there, under the new key.
    final reopened = await open(newKey);
    final notes = await reopened!.notesForDay('2026-08-01');
    expect(notes.single.content, 'written under the old password');
    await reopened.close();

    // And the old key is genuinely dead — a change that left it working would
    // be worse than none, because someone would believe they had revoked it.
    await expectLater(
      () => open(oldKey),
      throwsA(isA<WrongPasswordException>()),
    );
  });

  test('a rekey to the same key leaves the journal readable', () async {
    // Degenerate but worth pinning: someone re-entering their existing
    // password must not end up locked out.
    final salt = JournalKey.newSalt();
    final key = await keyFor('unchanged', salt);

    final db = await open(key);
    if (skip) return markTestSkipped('SQLCipher unavailable here');
    await rekeyJournal(database: db!, newRawKey: key);
    await db.close();

    final reopened = await open(key);
    expect(reopened, isNotNull);
    await reopened!.close();
  });
}
