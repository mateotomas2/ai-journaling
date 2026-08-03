import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/ai/journal_ai.dart';
import 'package:reflekt/features/ai/ask_page.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';

import '_spec.dart';

/// SPEC — Ask the journal a question
///
/// Searching finds a word you remember. Asking is for the things you cannot
/// search for — what you kept coming back to, how a month felt — where the
/// answer is spread across entries rather than sitting in one.
///
/// The AI is injected here and answers from a script. That is the point: a
/// spec that called OpenRouter would be slow, cost money on every run, and fail
/// for reasons unrelated to the code — and its recording would prove the
/// network worked, not that the app did. What this demonstrates is the app's
/// behaviour around an answer, **not** that any particular model answers well.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * the quality of the answer, which no spec can assert
///   * which entries are chosen as context — everything is sent for now, and
///     narrowing it is its own decision
///   * follow-up questions or any conversation history
void main() {
  const password = 'a good password';
  const entry = 'Ran in the rain and felt better afterwards.';
  const question = 'What lifted my mood?';
  const answer = 'Running, even in bad weather, seems to lift your mood.';

  /// The part delivered first. The scripted AI pauses after it, long enough
  /// that "arriving" is a state the spec can actually observe rather than a
  /// frame it might miss.
  const answerOpening = 'Running, even in bad weather,';

  runSpec(
    'Ask the journal a question',
    body: (spec) async {
      await spec.launch(
        ReflektApp(
          storageDirectory: spec.storageDirectory,
          ai: _ScriptedAi(answerOpening, answer),
        ),
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

      await spec.when('a question is asked of it', () async {
        await spec.tap(find.byKey(JournalHomeKeys.ask));
        await spec.eventually(find.byKey(AskKeys.field));
        await spec.type(find.byKey(AskKeys.field), question);
        await spec.tap(find.byKey(AskKeys.submit));
      });

      await spec.then('the answer begins before it is finished', () async {
        // An answer takes seconds to arrive, and a spinner for all of them
        // says only that something is happening. This says what.
        await spec.eventually(find.byKey(AskKeys.arriving));
        expect(find.textContaining(answerOpening), findsOneWidget);

        // Still arriving, so it is not yet part of the thread — a half-written
        // answer must never be mistaken for one the model finished.
        expect(find.byKey(AskKeys.answer), findsNothing);
      });

      await spec.and('the whole of it settles', () async {
        await spec.eventually(find.text(answer));
      });

      await spec.and('it shows what it was asked', () async {
        // The question stays on screen with the answer: an answer alone is
        // hard to judge once you have forgotten how you phrased it.
        expect(find.text(question), findsOneWidget);
      });
    },
  );
}

/// Answers from a script, so the spec is the same every run.
///
/// Delivers the answer in two parts with a pause between them. A real model
/// streams far more finely than this, but a stream that finishes in half a
/// second is not something a spec can assert against or a person can watch —
/// and the point of both is that the answer is visible *before* it is done.
class _ScriptedAi implements JournalAi {
  const _ScriptedAi(this.opening, this.answer);

  /// Arrives first, then the stream pauses.
  final String opening;

  /// The whole answer, [opening] included.
  final String answer;

  @override
  Stream<AiEvent> ask({
    required String question,
    required List<String> entries,
    List<Exchange> earlier = const [],
  }) async* {
    // A real call is not instant, and an answer that appeared in the same
    // frame as the question would hide whether the waiting state works at all.
    await Future<void>.delayed(const Duration(milliseconds: 700));

    // Word by word, as a real one arrives.
    for (final word in opening.split(' ')) {
      yield AiText('$word ');
      await Future<void>.delayed(const Duration(milliseconds: 120));
    }

    // Long enough to be seen, and to be asserted against.
    await Future<void>.delayed(const Duration(milliseconds: 1800));

    for (final word in answer.substring(opening.length).trim().split(' ')) {
      yield AiText('$word ');
      await Future<void>.delayed(const Duration(milliseconds: 120));
    }

    yield AiFinished(Answer(answer));
  }
}
