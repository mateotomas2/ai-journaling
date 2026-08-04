import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';

import '_spec.dart';

/// SPEC — Sort notes by what they are about
///
/// A day of undifferentiated notes is hard to read back. Categories turn a
/// pile into something you can scan.
///
/// Choosing one is optional, and that is the important part. Making someone
/// classify a thought before writing it down is a good way to stop them
/// writing it down.
///
/// A category is whatever the person calls it (ADR-0012). The four the app
/// used to insist on were chosen by us for someone else's life, and had
/// nothing for work, for the people they live with, or for whatever they are
/// actually preoccupied with this year.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * renaming a category everywhere at once
///   * filtering across days, which belongs with search
void main() {
  const password = 'a good password';
  const marked = 'The sourdough finally rose properly.';
  const plain = 'Flew over the old house again.';

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

      await spec.when('a note is written and given a word of your own',
          () async {
        await spec.tap(find.byKey(JournalHomeKeys.addNote));
        await spec.type(find.byKey(NoteComposerKeys.field), marked);
        // Not one of the four the app used to insist on — the point of
        // ADR-0012 is that a journal is filed in its owner's words.
        await spec.tap(find.byKey(NoteComposerKeys.addCategory));
        await spec.eventually(find.byKey(NoteComposerKeys.newCategory));
        await spec.type(find.byKey(NoteComposerKeys.newCategory), 'sourdough');
        await spec.tap(find.byKey(NoteComposerKeys.saveCategory));
        await spec.tap(find.byKey(NoteComposerKeys.save));
      });

      await spec.then('the journal shows what it was about', () async {
        await spec.eventually(onTheNote(marked));
        expect(onTheNote('Sourdough'), findsOneWidget);
      });

      await spec.when('a note is written without choosing one', () async {
        await spec.tap(find.byKey(JournalHomeKeys.addNote));
        await spec.type(find.byKey(NoteComposerKeys.field), plain);
        await spec.tap(find.byKey(NoteComposerKeys.save));
      });

      await spec.then('it is kept just the same', () async {
        // Uncategorised is a note, not a mistake.
        await spec.eventually(onTheNote(plain));
        expect(onTheNote(marked), findsOneWidget);
      });

      await spec.when('the day is filtered to that word', () async {
        await spec.tap(find.byKey(JournalHomeKeys.filterOf('sourdough')));
      });

      await spec.then('only that note is shown', () async {
        await spec.eventually(onTheNote(marked));
        expect(onTheNote(plain), findsNothing);
      });
    },
  );
}
