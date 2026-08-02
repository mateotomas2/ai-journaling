import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';

import '_spec.dart';

/// SPEC — Sort notes by what they are about
///
/// A day of undifferentiated notes is hard to read back. Categories turn a
/// pile into something you can scan: what was about health, what was a dream.
///
/// Choosing one is optional, and that is the important part. Making someone
/// classify a thought before writing it down is a good way to stop them
/// writing it down.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * inventing categories — a fixed set keeps the vocabulary scannable, and
///     open-ended tags grow into a list nobody remembers
///   * filtering across days, which belongs with search
void main() {
  const password = 'a good password';
  const dream = 'Flew over the old house again.';
  const plain = 'Bought bread on the way home.';

  // Scoped to the note list on purpose: once a day holds a categorised note
  // the filter chips carry the same words, so a bare find.text would be
  // satisfied by the chip rather than by the note being labelled.
  Finder onTheNote(String text) => find.descendant(
        of: find.byKey(JournalHomeKeys.noteList),
        matching: find.text(text),
      );

  runSpec(
    'Sort notes by what they are about',
    body: (spec) async {
      await spec.launch(ReflektApp(storageDirectory: spec.storageDirectory));

      await spec.given('an empty journal', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), password);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.addNote));
      });

      await spec.when('a note is written and marked as a dream', () async {
        await spec.tap(find.byKey(JournalHomeKeys.addNote));
        await spec.type(find.byKey(NoteComposerKeys.field), dream);
        await spec.tap(find.byKey(NoteComposerKeys.categoryOf('dream')));
        await spec.tap(find.byKey(NoteComposerKeys.save));
      });

      await spec.then('the journal shows what it was about', () async {
        await spec.eventually(onTheNote(dream));
        expect(onTheNote('Dream'), findsOneWidget);
      });

      await spec.when('a note is written without choosing one', () async {
        await spec.tap(find.byKey(JournalHomeKeys.addNote));
        await spec.type(find.byKey(NoteComposerKeys.field), plain);
        await spec.tap(find.byKey(NoteComposerKeys.save));
      });

      await spec.then('it is kept just the same', () async {
        // Uncategorised is a note, not a mistake.
        await spec.eventually(onTheNote(plain));
        expect(onTheNote(dream), findsOneWidget);
      });

      await spec.when('the day is filtered to dreams', () async {
        await spec.tap(find.byKey(JournalHomeKeys.filterOf('dream')));
      });

      await spec.then('only the dream is shown', () async {
        await spec.eventually(onTheNote(dream));
        expect(onTheNote(plain), findsNothing);
      });
    },
  );
}
