import 'dart:io';
import 'dart:typed_data';

import 'package:drift/drift.dart' show Value;
import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/db/journal_database.dart';
import 'package:reflekt/features/lock/journal_key.dart';

/// Which notes a backfill would pick up.
///
/// Covered here rather than as a spec: the interesting behaviour is *which*
/// notes are selected, and watching a progress indicator proves none of it.
/// The embedding itself needs the native runtime, so this exercises the query
/// that drives the backfill rather than the model.
void main() {
  late Directory dir;
  late JournalDatabase db;
  var skip = false;

  setUp(() async {
    dir = Directory.systemTemp.createTempSync('reflekt-backfill');
    try {
      db = await openJournalDatabase(
        rawKey: await JournalKey.derive(
          password: 'a good password',
          salt: JournalKey.newSalt(),
        ),
        overrideDirectory: dir.path,
      );
    } catch (error) {
      if (!error.toString().contains('Failed to load dynamic library')) rethrow;
      skip = true;
    }
  });

  tearDown(() async {
    if (!skip) await db.close();
    dir.deleteSync(recursive: true);
  });

  Future<void> write(String id, String content) => db.addNote(
        NotesCompanion(
          id: Value(id),
          dayId: const Value('2026-08-01'),
          content: Value(content),
          createdAt: Value(int.parse(id)),
        ),
      );

  test('finds notes that have never been embedded', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');
    await write('1', 'indexed already');
    await write('2', 'never indexed');
    await db.putEmbedding('1', Uint8List.fromList(List.filled(8, 1)));

    final pending = await db.notesWithoutEmbeddings();
    expect(pending.map((n) => n.id), ['2']);
  });

  test('ignores deleted notes', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');
    await write('1', 'something regretted');
    await db.deleteNote('1', DateTime.now());

    // Embedding a tombstone would put an empty string in the index and, worse,
    // give a deleted note a way back into search results (ADR-0007).
    expect(await db.notesWithoutEmbeddings(), isEmpty);
  });

  test('nothing to do once everything is indexed', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');
    await write('1', 'a note');
    await db.putEmbedding('1', Uint8List.fromList(List.filled(8, 1)));

    expect(await db.notesWithoutEmbeddings(), isEmpty);
  });

  test('a reindex replaces the old vector rather than adding one', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');
    await write('1', 'a note');
    await db.putEmbedding('1', Uint8List.fromList(List.filled(8, 1)));
    await db.putEmbedding('1', Uint8List.fromList(List.filled(8, 2)));

    // Two vectors for one note would make it appear twice in every search.
    expect(await db.countEmbeddings(), 1);
  });
}
