import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';

import '_spec.dart';

/// SPEC — Reword or remove a note
///
/// Writing without being able to correct or take back what you wrote makes a
/// journal something you approach carefully, which is the opposite of useful.
///
/// Deleting erases the writing and keeps only a tombstone (ADR-0007), so there
/// is deliberately no undo. What that buys is that a deleted note is actually
/// gone rather than hidden.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * undo, which ADR-0007 rules out by design
///   * editing a note on a day other than the one being read
///   * any confirmation step before deleting — worth considering, but it is a
///     product decision nobody has made and inventing one here would bury it
void main() {
  const password = 'a good password';
  const original = 'A first attempt at saying it.';
  const reworded = 'What I actually meant.';

  runSpec(
    'Reword or remove a note',
    body: (spec) async {
      await spec.launch(ReflektApp(storageDirectory: spec.storageDirectory));

      await spec.given('a note already written today', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), password);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.addNote));

        await spec.tap(find.byKey(JournalHomeKeys.addNote));
        await spec.type(find.byKey(NoteComposerKeys.field), original);
        await spec.tap(find.byKey(NoteComposerKeys.save));
        await spec.eventually(find.text(original));
      });

      await spec.when('the note is opened and reworded', () async {
        await spec.tap(find.text(original));
        await spec.eventually(find.byKey(NoteComposerKeys.field));
        await spec.type(find.byKey(NoteComposerKeys.field), reworded,
            clear: true);
        await spec.tap(find.byKey(NoteComposerKeys.save));
      });

      await spec.then('the journal shows the new wording', () async {
        await spec.eventually(find.text(reworded));
      });

      await spec.and('the old wording is gone', () async {
        expect(find.text(original), findsNothing);
      });

      await spec.when('the note is deleted', () async {
        await spec.tap(find.text(reworded));
        await spec.eventually(find.byKey(NoteComposerKeys.delete));
        await spec.tap(find.byKey(NoteComposerKeys.delete));
      });

      await spec.then('the day is empty again', () async {
        await spec.eventually(find.byKey(JournalHomeKeys.emptyState));
        expect(find.text(reworded), findsNothing);
      });
    },
  );
}
