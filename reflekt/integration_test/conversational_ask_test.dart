import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/ai/ask_page.dart';
import 'package:reflekt/features/ai/journal_ai.dart';
import 'package:reflekt/features/ai/journal_tool.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';

import '_spec.dart';

/// SPEC — Ask follow-up questions without starting over
///
/// Asking used to start cold every time, which made the second question the
/// hardest one: you had to restate everything the first had already
/// established. Follow-ups are where the value is — "what was I worried about
/// in March?", then "did that change?".
///
/// This is a chat you can open, not the journal becoming a chat (ADR-0008).
///
/// The AI is scripted, and it answers the follow-up by quoting the earlier
/// exchange back. That is how the spec proves the thread was actually sent
/// rather than merely displayed — a page that shows both questions but sends
/// only the last would look identical.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * keeping the thread across a lock — see the criterion below, it is
///     dropped on purpose
///   * editing or retrying an earlier question
void main() {
  const password = 'a good password';
  const entry = 'Started running again after a long gap.';
  const first = 'What did I start doing?';
  const followUp = 'And when?';

  runSpec(
    'Ask follow-up questions without starting over',
    body: (spec) async {
      final ai = _ThreadAwareAi();

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

      await spec.when('a first question is asked', () async {
        await spec.tap(find.byKey(JournalHomeKeys.ask));
        await spec.eventually(find.byKey(AskKeys.field));
        await spec.type(find.byKey(AskKeys.field), first);
        await spec.tap(find.byKey(AskKeys.submit));
        await spec.eventually(find.text('You started running.'));
      });

      await spec.when('a follow-up is asked', () async {
        await spec.type(find.byKey(AskKeys.field), followUp);
        await spec.tap(find.byKey(AskKeys.submit));
      });

      await spec.then('it is answered in light of the first', () async {
        // The scripted AI only says this when the earlier exchange reached it.
        await spec.eventually(find.text('After a long gap — the running.'));
      });

      await spec.and('the whole thread is still readable', () async {
        expect(find.text(first), findsOneWidget);
        expect(find.text('You started running.'), findsOneWidget);
        expect(find.text(followUp), findsOneWidget);
      });
    },
  );
}

/// Answers the second question only if the first one reached it.
class _ThreadAwareAi implements JournalAi {
  @override
  Stream<AiEvent> ask({
    required String question,
    required List<String> entries,
    List<Exchange> earlier = const [],
    List<JournalTool> tools = const [],
  }) async* {
    await Future<void>.delayed(const Duration(milliseconds: 600));

    final reply = earlier.isEmpty
        ? 'You started running.'
        : 'After a long gap — the ${earlier.last.answer.split(" ").last}';

    yield AiText(reply);
    yield AiFinished(Answer(reply));
  }
}
