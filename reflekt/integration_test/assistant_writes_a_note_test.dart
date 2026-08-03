import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/ai/ask_page.dart';
import 'package:reflekt/features/ai/journal_ai.dart';
import 'package:reflekt/features/ai/journal_tool.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';

import '_spec.dart';

/// SPEC — The assistant writes a note when asked
///
/// Once asking holds a thread, "save that as a note" is something you would
/// actually say mid-answer, and typing it out again is the worse path.
///
/// The important half of this spec is the half that asserts **nothing was
/// written**. An assistant that records things unprompted is a different and
/// less trustworthy product: a journal has to be somewhere you can think out
/// loud without it being minuted. Written one-sided, a bug that saved every
/// exchange would pass.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * the assistant editing or deleting existing notes — writing is the
///     reversible half, and the rest deserves its own decision
///   * saving onto a day other than today
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

      await spec.given('a journal with something written in it', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), password);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.addNote));

        await spec.tap(find.byKey(JournalHomeKeys.addNote));
        await spec.type(find.byKey(NoteComposerKeys.field), entry);
        await spec.tap(find.byKey(NoteComposerKeys.save));
        await spec.eventually(find.text(entry));
      });

      await spec.when('a question is asked without asking for a note',
          () async {
        await spec.tap(find.byKey(JournalHomeKeys.ask));
        await spec.eventually(find.byKey(AskKeys.field));
        await spec.type(find.byKey(AskKeys.field), 'How have I been sleeping?');
        await spec.tap(find.byKey(AskKeys.submit));
        await spec.eventually(find.byKey(AskKeys.answer),
            timeout: const Duration(seconds: 180));
      });

      await spec.then('nothing was written down', () async {
        // The half that matters most. Answering is not a reason to record.
        expect(ai.notesWritten, 0);
      });

      await spec.when('the assistant is asked to save that', () async {
        await spec.type(find.byKey(AskKeys.field), 'Save that as a note');
        await spec.tap(find.byKey(AskKeys.submit));
        await spec.eventually(find.text('Saved that as a note.'),
            timeout: const Duration(seconds: 180));
      });

      await spec.then("it appears on today's journal", () async {
        await spec.tester.pageBack();
        await spec.eventually(find.text(saved));
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

/// Saves only when the question asks it to, and counts what it wrote.
class _AssistantThatSavesOnRequest implements JournalAi {
  _AssistantThatSavesOnRequest(this.note);

  final String note;
  int notesWritten = 0;

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

    notesWritten++;
    const reply = 'Saved that as a note.';
    yield const AiText(reply);
    yield AiFinished(Answer(reply, noteToWrite: note));
  }
}
