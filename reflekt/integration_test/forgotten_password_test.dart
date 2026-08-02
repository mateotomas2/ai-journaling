import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';
import 'package:reflekt/features/lock/forgotten_password_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';
import 'package:reflekt/features/lock/unlock_page.dart';

import '_spec.dart';

/// SPEC — A forgotten password cannot be recovered
///
/// Someone locked out has exactly one option, and deserves to be told rather
/// than left guessing at a password screen. There is no recovery by design
/// (ADR-0006): a key Google cannot read is a key nobody can reset.
///
/// So this is a dead end with an exit — it says plainly that the journal is
/// unreachable, and offers to clear it and start again.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * exporting anything before clearing — it cannot be decrypted without the
///     password, so there is nothing to export
///   * clearing only part of the journal
void main() {
  const password = 'a good password';
  const note = 'Written before everything was cleared.';

  runSpec(
    'A forgotten password cannot be recovered',
    body: (spec) async {
      await spec.launch(ReflektApp(storageDirectory: spec.storageDirectory));

      await spec.given('a locked journal with something in it', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), password);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.addNote));

        await spec.tap(find.byKey(JournalHomeKeys.addNote));
        await spec.type(find.byKey(NoteComposerKeys.field), note);
        await spec.tap(find.byKey(NoteComposerKeys.save));
        await spec.eventually(find.text(note));

        await spec.restart(ReflektApp(storageDirectory: spec.storageDirectory));
        await spec.eventually(find.byKey(UnlockKeys.field));
      });

      await spec.when('the forgotten-password link is followed', () async {
        await spec.tap(find.byKey(UnlockKeys.forgotten));
      });

      await spec.then('it says the journal cannot be recovered', () async {
        await spec.eventually(find.byKey(ForgottenPasswordKeys.explanation));
      });

      await spec.when('everything is cleared', () async {
        await spec.tap(find.byKey(ForgottenPasswordKeys.clear));
        await spec.eventually(find.byKey(ForgottenPasswordKeys.confirm));
        await spec.tap(find.byKey(ForgottenPasswordKeys.confirm));
      });

      await spec.then('the journal asks for a new password', () async {
        await spec.eventually(find.byKey(SetPasswordKeys.field));
      });

      await spec.when('a new password is chosen', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), 'a different one');
        await spec.tap(find.byKey(SetPasswordKeys.submit));
      });

      await spec.then('the journal is empty', () async {
        // The point of clearing: what was there is unreachable, and the new
        // journal does not inherit it.
        await spec.eventually(find.byKey(JournalHomeKeys.emptyState));
        expect(find.text(note), findsNothing);
      });
    },
  );
}
