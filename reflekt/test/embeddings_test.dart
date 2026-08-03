import 'dart:io';
import 'dart:typed_data';

import 'package:drift/drift.dart' show Value;
import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/db/journal_database.dart';
import 'package:reflekt/features/lock/journal_key.dart';

/// The index now holds two kinds of thing, so it is keyed by what a vector
/// belongs to rather than by a note id (ADR-0010). These are the guarantees
/// that keeps: a note and a message can share an id without colliding, and
/// removing one never removes the other.
void main() {
  late Directory dir;
  late JournalDatabase db;
  var skip = false;

  setUp(() async {
    dir = Directory.systemTemp.createTempSync('reflekt-embeddings');
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

  Uint8List vector(int seed) =>
      Uint8List.fromList(List.filled(4, seed));

  test('a note and a message with the same id do not collide', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    // Ids are minted from the clock, so a note and a message written in the
    // same microsecond genuinely can share one. Keyed by note id alone, the
    // second write would have silently overwritten the first.
    await db.putEmbeddingFor(IndexedKind.note, '7', vector(1));
    await db.putEmbeddingFor(IndexedKind.message, '7', vector(2));

    expect(await db.countEmbeddings(), 2);
  });

  test('removing one kind leaves the other', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    await db.putEmbeddingFor(IndexedKind.note, '7', vector(1));
    await db.putEmbeddingFor(IndexedKind.message, '7', vector(2));

    await db.removeEmbeddingFor(IndexedKind.note, '7');

    expect(await db.countEmbeddings(), 1);
  });

  test('re-indexing replaces a vector rather than adding one', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    await db.putEmbeddingFor(IndexedKind.note, '7', vector(1));
    await db.putEmbeddingFor(IndexedKind.note, '7', vector(2));

    expect(await db.countEmbeddings(), 1);
  });

  test('a message vector is never mistaken for a note', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    await db.addNote(
      NotesCompanion(
        id: const Value('7'),
        dayId: const Value('2026-08-01'),
        content: const Value('a note'),
        createdAt: const Value(100),
      ),
    );
    await db.putEmbeddingFor(IndexedKind.message, '7', vector(2));

    // The note shares an id with an indexed message and has no vector of its
    // own, so it is still waiting to be indexed.
    expect(await db.notesWithEmbeddings(), isEmpty);
    expect((await db.notesWithoutEmbeddings()).single.id, '7');
  });
}
