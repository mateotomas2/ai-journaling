import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';

import '_spec.dart';

/// SPEC — A journal with nothing in it says what it is
///
/// A new journal opens on an empty day with a button and two chips, and none
/// of it explains that the day has two surfaces, that days are something you
/// swipe through, or that the assistant can write in here when asked.
///
/// Said in the empty space itself rather than in a modal. Something you have
/// to dismiss before you can write is a strange greeting from an app whose
/// whole claim is that writing is frictionless — and it arrives before any of
/// it means anything.
///
/// It goes when the journal holds something. Advice is only welcome while it
/// is still needed, and a journal with writing in it has answered the question
/// for itself.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * a tour, or anything with a Next button
///   * bringing it back from Settings — a journal that has been written in has
///     stopped being new
///   * the password warning, which belongs where the password is chosen and is
///     already there
void main() {
  const password = 'a good password';
  const entry = 'Started keeping this today.';

  runSpec(
    'A journal with nothing in it says what it is',
    body: (spec) async {
      await spec.launch(ReflektApp(storageDirectory: spec.storageDirectory));

      await spec.given('a journal just created', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), password);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.emptyState));
      });

      await spec.then('it explains itself, without asking for anything',
          () async {
        await spec.eventually(find.byKey(JournalHomeKeys.firstRun));
        expect(find.textContaining('talk to the day'), findsOneWidget);
        expect(find.textContaining('Swipe right'), findsOneWidget);

        // Nothing to dismiss, nothing to step through — the composer is one
        // tap away the whole time.
        expect(find.byKey(JournalHomeKeys.addNote), findsOneWidget);
      });

      await spec.when('something is written', () async {
        await spec.tap(find.byKey(JournalHomeKeys.addNote));
        await spec.type(find.byKey(NoteComposerKeys.field), entry);
        await spec.tap(find.byKey(NoteComposerKeys.save));
        await spec.eventually(find.textContaining(entry));
      });

      await spec.and('the day is turned back to an empty one', () async {
        await spec.swipeRight(find.byKey(JournalHomeKeys.dayPager));
        await spec.eventually(find.byKey(JournalHomeKeys.emptyState));
      });

      await spec.then('the explaining is over', () async {
        // A journal with writing in it has answered the question itself.
        expect(find.byKey(JournalHomeKeys.firstRun), findsNothing);
        expect(find.textContaining('Swipe right for earlier days'),
            findsOneWidget);
      });
    },
  );
}
