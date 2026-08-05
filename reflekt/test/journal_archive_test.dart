import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart' show Value;
import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/db/journal_database.dart';
import 'package:reflekt/features/lock/journal_key.dart';
import 'package:reflekt/features/settings/journal_archive.dart';

/// The journal as a file (ADR-0011).
///
/// Plaintext is the decision, so what matters most here is what is left *out*
/// of the file: a live API key and anything the person deleted.
void main() {
  late Directory dir;
  late JournalDatabase db;
  var skip = false;

  setUp(() async {
    dir = Directory.systemTemp.createTempSync('reflekt-archive');
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

  Future<void> note(String id, String content, {int at = 100}) => db.addNote(
        NotesCompanion(
          id: Value(id),
          dayId: const Value('2026-08-01'),
          content: Value(content),
          createdAt: Value(at),
        ),
      );

  Future<Map<String, dynamic>> exported() async {
    final file = await JournalArchive.write(db, dir.path);
    return jsonDecode(await file.readAsString()) as Map<String, dynamic>;
  }

  test('writes the notes and messages someone has', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    await note('1', 'Ran in the rain.');
    await db.addMessage(MessagesCompanion(
      id: const Value('m1'),
      dayId: const Value('2026-08-01'),
      role: Value(MessageRole.user.name),
      content: const Value('Why did that help?'),
      createdAt: const Value(200),
    ));

    final archive = await exported();

    expect((archive['notes'] as List).single['content'], 'Ran in the rain.');
    expect(
      (archive['messages'] as List).single['content'],
      'Why did that help?',
    );
  });

  test('never writes the API key into a plaintext file', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    // The one thing in that table that can spend the owner's money. A file
    // carrying it is a different and much worse artefact than one carrying
    // someone's notes.
    await db.putSetting('openrouter.api_key', 'sk-or-secret');
    await db.putSetting('openrouter.model', 'anthropic/claude-sonnet-4.5');

    final archive = await exported();
    final settings = archive['settings'] as Map<String, dynamic>;

    expect(settings.containsKey('openrouter.api_key'), isFalse);
    expect(settings['openrouter.model'], 'anthropic/claude-sonnet-4.5');
  });

  test('a key hidden in a hand-edited file is not imported either', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    final file = File('${dir.path}/${JournalArchive.fileName}');
    await file.writeAsString(jsonEncode({
      'reflekt': JournalArchive.version,
      'notes': [],
      'messages': [],
      'settings': {'openrouter.api_key': 'sk-or-planted'},
    }));

    await JournalArchive.read(db, file);

    expect(await db.setting('openrouter.api_key'), isNull);
  });

  test('does not write out what was deleted', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    await note('1', 'Kept.');
    await note('2', 'Regretted.', at: 200);
    await db.deleteNote('2', DateTime.fromMillisecondsSinceEpoch(300));

    final archive = await exported();

    // A deletion is meant to be final (ADR-0007). Writing erased rows into a
    // file someone might re-import would work against that.
    expect((archive['notes'] as List).map((n) => n['content']), ['Kept.']);
  });

  test('brings a journal back', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    await note('1', 'Ran in the rain.');
    final file = await JournalArchive.write(db, dir.path);

    await db.deleteNote('1', DateTime.fromMillisecondsSinceEpoch(400));
    expect(await db.notesForDay('2026-08-01'), isEmpty);

    await JournalArchive.read(db, file);

    final back = await db.notesForDay('2026-08-01');
    expect(back.single.content, 'Ran in the rain.');
  });

  test('importing adds to a journal rather than replacing it', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    await note('1', 'From the file.');
    final file = await JournalArchive.write(db, dir.path);

    await note('2', 'Written since.', at: 500);
    await JournalArchive.read(db, file);

    // Restoring one lost note must not cost every note written since.
    expect(
      (await db.notesForDay('2026-08-01')).map((n) => n.content),
      containsAll(['From the file.', 'Written since.']),
    );
  });

  test('refuses a file it does not understand', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    final file = File('${dir.path}/nonsense.json');
    await file.writeAsString(jsonEncode({'reflekt': 99, 'notes': []}));

    await expectLater(
      () => JournalArchive.read(db, file),
      throwsA(isA<ArchiveUnreadable>()),
    );
  });
}
