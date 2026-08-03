import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/ai/ask_page.dart';
import 'package:reflekt/features/ai/journal_ai.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';

import '_spec.dart';

/// SPEC — Only the entries a question needs are sent
///
/// Asking used to send every entry ever written. That costs more the longer
/// someone keeps a journal, and exposes years of writing to answer something
/// about a week of it. Asking is the one moment this app's privacy promise is
/// deliberately relaxed, so how much is relaxed matters.
///
/// The AI here is scripted and reports back what it was given, which is how the
/// spec can assert on something the interface never shows. A page that looked
/// identical while sending everything is exactly the bug worth catching.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * how many entries is the right number — 12 is a starting point, not a
///     measured one
///   * telling the user which entries were sent, which is worth doing and is
///     its own decision
void main() {
  const password = 'a good password';
  const aboutRunning = 'Went for a long run before work and felt clearer.';
  const aboutBread = 'The sourdough finally rose properly.';
  const aboutTax = 'Spent the evening on the tax return, hated every minute.';

  runSpec(
    'Only the entries a question needs are sent',
    body: (spec) async {
      final ai = _ReportingAi();

      await spec.launch(
        ReflektApp(storageDirectory: spec.storageDirectory, ai: ai),
      );

      Future<void> write(String text) async {
        await spec.tap(find.byKey(JournalHomeKeys.addNote));
        await spec.type(find.byKey(NoteComposerKeys.field), text);
        await spec.tap(find.byKey(NoteComposerKeys.save));
        await spec.eventually(find.text(text));
      }

      await spec.given('a journal covering several unrelated things', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), password);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.addNote));

        await write(aboutRunning);
        await write(aboutBread);
        await write(aboutTax);
      });

      await spec.when('a question about exercise is asked', () async {
        await spec.tap(find.byKey(JournalHomeKeys.ask));
        await spec.eventually(find.byKey(AskKeys.field));
        await spec.type(find.byKey(AskKeys.field), 'How did exercise feel?');
        await spec.tap(find.byKey(AskKeys.submit));
        await spec.eventually(find.byKey(AskKeys.answer),
            timeout: const Duration(seconds: 180));
      });

      await spec.then('the entry about running was the closest one sent',
          () async {
        // Asserting on what left the device, which no screen displays.
        expect(ai.received.first, aboutRunning);
      });

      await spec.and('the journal was not sent wholesale', () async {
        // The real claim: fewer entries leave the device than exist. With only
        // three notes the saving is small; the behaviour is what matters, and
        // it is what grows with a journal.
        expect(ai.received, isNot(contains(aboutTax)));
      });
    },
  );
}

/// Answers, and keeps what it was handed so the spec can inspect it.
class _ReportingAi implements JournalAi {
  List<String> received = const [];

  @override
  Future<Answer> ask({
    required String question,
    required List<String> entries,
    List<Exchange> earlier = const [],
  }) async {
    received = entries;
    await Future<void>.delayed(const Duration(milliseconds: 500));
    return const Answer('It sounds like running helped.');
  }
}
