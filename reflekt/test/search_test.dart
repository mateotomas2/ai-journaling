import 'dart:io';

import 'package:drift/drift.dart' show Value;
import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/db/journal_database.dart';
import 'package:reflekt/features/lock/journal_key.dart';

/// Searching across days.
///
/// The wildcard cases are the point. `LIKE` treats `%` and `_` as wildcards, so
/// without escaping, searching for "50%" would match every note in the journal
/// — a search that silently returns everything looks like a search that works.
void main() {
  late Directory dir;
  late JournalDatabase db;
  var skip = false;

  setUp(() async {
    dir = Directory.systemTemp.createTempSync('reflekt-search');
    try {
      db = await openJournalDatabase(
        rawKey: await JournalKey.derive(
          password: 'a good password',
          salt: JournalKey.newSalt(),
        ),
        overrideDirectory: dir.path,
      );
    } catch (error) {
      // The prebuilt SQLCipher needs a newer glibc than some distributions
      // ship. These run in CI.
      if (!error.toString().contains('Failed to load dynamic library')) rethrow;
      skip = true;
    }
  });

  tearDown(() async {
    if (!skip) await db.close();
    dir.deleteSync(recursive: true);
  });

  Future<void> write(String id, String dayId, String content) => db.addNote(
        NotesCompanion(
          id: Value(id),
          dayId: Value(dayId),
          content: Value(content),
          createdAt: Value(int.parse(id)),
        ),
      );

  Future<List<String>> find(String query) async =>
      (await db.searchNotes(query)).map((n) => n.content).toList();

  test('finds notes across different days', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');
    await write('1', '2026-08-01', 'The sourdough finally worked');
    await write('2', '2026-08-02', 'Rain all day');

    expect(await find('sourdough'), ['The sourdough finally worked']);
  });

  test('ignores case', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');
    await write('1', '2026-08-01', 'The Sourdough finally worked');

    expect(await find('SOURDOUGH'), hasLength(1));
  });

  test('returns the newest first', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');
    await write('1', '2026-08-01', 'walked to the river');
    await write('2', '2026-08-02', 'walked further today');

    expect(await find('walked').then((r) => r.first), 'walked further today');
  });

  test('treats % as a character, not a wildcard', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');
    await write('1', '2026-08-01', 'battery at 50% again');
    await write('2', '2026-08-02', 'nothing to do with batteries');

    // Unescaped, this query would match both — and a search that returns
    // everything reads as a search that found everything.
    expect(await find('50%'), ['battery at 50% again']);
  });

  test('treats _ as a character, not a wildcard', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');
    await write('1', '2026-08-01', 'the file was named draft_two');
    await write('2', '2026-08-02', 'drafts everywhere');

    expect(await find('draft_t'), ['the file was named draft_two']);
  });

  test('does not find deleted notes', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');
    await write('1', '2026-08-01', 'something regretted');
    await db.deleteNote('1', DateTime.now());

    expect(await find('regretted'), isEmpty);
  });
}
