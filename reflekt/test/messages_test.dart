import 'dart:io';

import 'package:drift/drift.dart' show Value;
import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/db/journal_database.dart';
import 'package:reflekt/features/lock/journal_key.dart';

/// How a day's conversation is stored.
///
/// Covered here rather than as a spec: the interesting behaviour is which rows
/// come back and which stay buried, and none of that is visible on screen. The
/// chat a person actually sees is specified by its own recording.
void main() {
  late Directory dir;
  late JournalDatabase db;
  var skip = false;

  setUp(() async {
    dir = Directory.systemTemp.createTempSync('reflekt-messages');
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

  Future<void> say(
    String id,
    String content, {
    String dayId = '2026-08-01',
    MessageRole role = MessageRole.user,
    int at = 0,
  }) =>
      db.addMessage(
        MessagesCompanion(
          id: Value(id),
          dayId: Value(dayId),
          role: Value(role.name),
          content: Value(content),
          createdAt: Value(at),
        ),
      );

  test('a day holds the conversation that happened on it', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    await say('1', 'How did last week go?', at: 100);
    await say('2', 'You wrote about sleeping badly.',
        role: MessageRole.assistant, at: 200);
    await say('3', 'A different day entirely.', dayId: '2026-08-02', at: 300);

    final thread = await db.messagesForDay('2026-08-01');

    expect(thread.map((m) => m.content), [
      'How did last week go?',
      'You wrote about sleeping badly.',
    ]);
  });

  test('the thread reads oldest first, as it was said', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    await say('2', 'second', at: 200);
    await say('1', 'first', at: 100);
    await say('3', 'third', at: 300);

    final thread = await db.messagesForDay('2026-08-01');

    expect(thread.map((m) => m.content), ['first', 'second', 'third']);
  });

  test('who said what is kept, because it decides what happens next',
      () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    await say('1', 'mine', at: 100);
    await say('2', 'the machine', role: MessageRole.assistant, at: 200);

    final thread = await db.messagesForDay('2026-08-01');

    expect(thread.map((m) => m.role), ['user', 'assistant']);
  });

  test('deleting a message erases what it said and leaves a tombstone',
      () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    await say('1', 'Something regretted.', at: 100);
    await db.deleteMessage('1', DateTime.fromMillisecondsSinceEpoch(500));

    expect(await db.messagesForDay('2026-08-01'), isEmpty);

    // The row survives so a restore cannot resurrect the text, and the text
    // itself is gone rather than merely hidden (ADR-0007).
    final rows = await db.customSelect('SELECT content, deleted_at FROM messages')
        .get();
    expect(rows.single.data['content'], '');
    expect(rows.single.data['deleted_at'], 500);
  });

  test('only what the person wrote is offered for indexing', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    await say('1', 'mine', at: 100);
    await say('2', 'the machine', role: MessageRole.assistant, at: 200);
    await say('3', 'also mine', at: 300);
    await db.deleteMessage('3', DateTime.fromMillisecondsSinceEpoch(400));

    // An assistant reply restates what it was given, so indexing it would
    // return the machine paraphrasing you ahead of your own words (ADR-0010).
    // A deleted message is gone for the same reason a deleted note is.
    final indexable = await db.messagesToIndex();

    expect(indexable.map((m) => m.content), ['mine']);
  });

  test('a search for % finds the character, not everything', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    await say('1', 'up 50% on last month', at: 100);
    await say('2', 'nothing numeric here', at: 200);

    expect((await db.searchMessages('50%')).map((m) => m.id), ['1']);
    expect(await db.searchMessages('%'), hasLength(1));
  });

  test('a deleted message cannot be searched back up', () async {
    if (skip) return markTestSkipped('SQLCipher unavailable here');

    await say('1', 'findable', at: 100);
    await db.deleteMessage('1', DateTime.fromMillisecondsSinceEpoch(200));

    expect(await db.searchMessages('findable'), isEmpty);
  });
}
