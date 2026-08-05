import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/ai/journal_ai.dart';
import 'package:reflekt/features/ai/journal_tool.dart';
import 'package:reflekt/features/chat/day_chat.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';

import '_spec.dart';

/// SPEC — The assistant writes a note when asked
///
/// "Save that as a note" is something you would actually say mid-conversation,
/// and typing it out again yourself is the worse path.
///
/// The important half of this spec is the half that asserts **nothing was
/// written**. An assistant that records things unprompted is a different and
/// less trustworthy product: a journal has to be somewhere you can think out
/// loud without it being minuted. Written one-sided, a bug that saved every
/// exchange would pass.
///
/// The scripted assistant runs the journal's *real* `write_note` tool — the
/// same object the model is handed. A fake that wrote to the database itself
/// would prove the spec and nothing about the tool.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * changing or erasing a note, which the same loop covers by another tool
///   * saving onto a day other than the one being written on
void main() {
  const password = 'a good password';
  const entry = 'Slept badly again, third night running.';
  const saved = 'Sleep has been poor for three nights.';

  runSpec(
    'The assistant writes a note when asked',
    body: (spec) async {
      final ai = _AssistantThatSavesOnRequest(saved);

      await spec.launch(
        ReflektApp(storageDirectory: spec.storageDirectory, ai: ai),
      );

      await spec.given('a day with something written on it', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), password);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.addNote));

        await spec.tap(find.byKey(JournalHomeKeys.addNote));
        await spec.type(find.byKey(NoteComposerKeys.field), entry);
        await spec.tap(find.byKey(NoteComposerKeys.save));
        await spec.eventually(find.text(entry));
      });

      await spec.when('something is said without asking for a note', () async {
        await spec.tap(find.byKey(JournalHomeKeys.showChat));
        await spec.eventually(find.byKey(ChatKeys.field));
        await spec.type(find.byKey(ChatKeys.field), 'How have I been sleeping?');
        await spec.tap(find.byKey(ChatKeys.send));
        await spec.eventually(
          find.text('Not well — three poor nights in a row.'),
          timeout: const Duration(seconds: 180),
        );
      });

      await spec.then('nothing was written down', () async {
        // The half that matters most. Answering is not a reason to record.
        expect(ai.toolsRun, isEmpty);
      });

      await spec.when('the assistant is asked to save that', () async {
        await spec.type(find.byKey(ChatKeys.field), 'Save that as a note');
        await spec.tap(find.byKey(ChatKeys.send));
        await spec.eventually(
          find.text('Saved that as a note.'),
          timeout: const Duration(seconds: 180),
        );
      });

      await spec.then('it used the journal to write it', () async {
        expect(ai.toolsRun, ['write_note']);
      });

      await spec.and('the note is on the day, beside the other one', () async {
        await spec.tap(find.byKey(JournalHomeKeys.showNotes));
        await spec.eventually(find.text(saved));
        expect(find.text(entry), findsOneWidget);
      });

      await spec.and('it is an ordinary note, editable like any other',
          () async {
        // Not a special kind of note. Treating it as one would make it harder
        // to correct, which is exactly backwards for something a model wrote.
        await spec.tap(find.text(saved));
        await spec.eventually(find.byKey(NoteComposerKeys.field));
        expect(find.byKey(NoteComposerKeys.delete), findsOneWidget);
      });
    },
  );
}

/// Reaches for the journal's own `write_note` only when asked to save.
class _AssistantThatSavesOnRequest implements JournalAi {
  _AssistantThatSavesOnRequest(this.note);

  final String note;

  /// The names of the tools it actually ran, in order.
  final toolsRun = <String>[];

  @override
  Stream<AiEvent> ask({
    required String question,
    required List<String> entries,
    List<Exchange> earlier = const [],
    List<JournalTool> tools = const [],
  }) async* {
    await Future<void>.delayed(const Duration(milliseconds: 500));

    if (!question.toLowerCase().contains('save')) {
      const reply = 'Not well — three poor nights in a row.';
      yield const AiText(reply);
      yield const AiFinished(Answer(reply));
      return;
    }

    final write = tools.firstWhere((tool) => tool.name == 'write_note');
    await write.run({'content': note, 'category': 'health'});
    toolsRun.add(write.name);
    yield AiToolRan(write.name);

    await Future<void>.delayed(const Duration(milliseconds: 400));

    const reply = 'Saved that as a note.';
    yield const AiText(reply);
    yield const AiFinished(Answer(reply));
  }
}
