import 'dart:io';

import 'package:drift/drift.dart' show Value;
import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/db/journal_database.dart';
import 'package:reflekt/features/lock/journal_key.dart';

/// Opening a journal that already exists.
///
/// **Specs cannot catch this.** Every spec starts from a fresh temp directory,
/// so it only ever exercises a database created from scratch — where drift
/// builds the current schema directly and every migration is skipped. A column
/// added without a migration therefore passes every spec and breaks on the
/// first upgrade of a real journal, which is the one case that matters and the
/// one nobody sees until it is shipped.
///
/// These tests reopen the same file instead, which is what an app update does.
void main() {
  late Directory dir;
  var skip = false;

  setUp(() => dir = Directory.systemTemp.createTempSync('reflekt-migration'));
  tearDown(() => dir.deleteSync(recursive: true));

  Future<JournalDatabase?> open(String rawKey) async {
    try {
      return await openJournalDatabase(
        rawKey: rawKey,
        overrideDirectory: dir.path,
      );
    } catch (error) {
      if (!error.toString().contains('Failed to load dynamic library')) rethrow;
      skip = true;
      return null;
    }
  }

  test('a journal written once can be reopened and added to', () async {
    final salt = JournalKey.newSalt();
    final key = await JournalKey.derive(password: 'a good password', salt: salt);

    final first = await open(key);
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    await first!.addNote(
      NotesCompanion(
        id: const Value('1'),
        dayId: const Value('2026-08-01'),
        content: const Value('written before the upgrade'),
        category: const Value('dream'),
        createdAt: Value(DateTime.now().millisecondsSinceEpoch),
      ),
    );
    await first.close();

    // Reopening is what an app update does: the file already exists, so drift
    // runs migrations rather than creating the schema.
    final second = await open(key);
    final notes = await second!.notesForDay('2026-08-01');

    expect(notes, hasLength(1));
    expect(notes.single.content, 'written before the upgrade');
    expect(notes.single.category, 'dream');

    // And it must still be writable — a half-migrated table reads fine and
    // fails on the next insert.
    await second.addNote(
      NotesCompanion(
        id: const Value('2'),
        dayId: const Value('2026-08-01'),
        content: const Value('written after'),
        createdAt: Value(DateTime.now().millisecondsSinceEpoch),
      ),
    );
    expect(await second.notesForDay('2026-08-01'), hasLength(2));
    await second.close();
  });

  test('settings and summaries survive a reopen', () async {
    final salt = JournalKey.newSalt();
    final key = await JournalKey.derive(password: 'a good password', salt: salt);

    final first = await open(key);
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    await first!.putSetting('openrouter.api_key', 'sk-or-test');
    await first.close();

    final second = await open(key);
    expect(await second!.setting('openrouter.api_key'), 'sk-or-test');
    await second.close();
  });
}
