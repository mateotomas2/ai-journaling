import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';
import 'package:reflekt/features/lock/change_password_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';
import 'package:reflekt/features/lock/unlock_page.dart';
import 'package:reflekt/features/settings/settings_page.dart';

import '_spec.dart';

/// SPEC — Change the password without losing the journal
///
/// Passwords get shared by accident or typed on the wrong screen, and until now
/// there was no way to change one.
///
/// This rewrites every page of the database, so the criterion that matters is
/// that nothing is lost. `PRAGMA rekey` does the rewrite in a transaction: the
/// file opens with the old key or the new one, never neither — which is the
/// only outcome that would actually destroy a journal.
///
/// The wrong-password path is asserted first. A change that proceeded on a
/// mistyped current password would re-encrypt the journal under a key its owner
/// never chose, and there is no recovery from that (ADR-0006).
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * what happens to a Drive backup made under the old password — it stays
///     readable with the old one, and reconciling that belongs with #21
void main() {
  const first = 'the first password';
  const second = 'the second password';
  const note = 'Written before the password changed.';

  runSpec(
    'Change the password without losing the journal',
    body: (spec) async {
      await spec.launch(ReflektApp(storageDirectory: spec.storageDirectory));

      await spec.given('a journal with something written in it', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), first);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.addNote));

        await spec.tap(find.byKey(JournalHomeKeys.addNote));
        await spec.type(find.byKey(NoteComposerKeys.field), note);
        await spec.tap(find.byKey(NoteComposerKeys.save));
        await spec.eventually(find.text(note));
      });

      await spec.when('the wrong current password is offered', () async {
        await spec.tap(find.byKey(JournalHomeKeys.settings));
        await spec.eventually(find.byKey(SettingsKeys.apiKeyField));
        await spec.scrollTo(find.byKey(SettingsKeys.changePassword));
        await spec.tap(find.byKey(SettingsKeys.changePassword));
        await spec.eventually(find.byKey(ChangePasswordKeys.current));

        await spec.type(find.byKey(ChangePasswordKeys.current), 'not it');
        await spec.type(find.byKey(ChangePasswordKeys.replacement), second);
        // Two fields and a warning put the button under the keyboard.
        await spec.scrollTo(find.byKey(ChangePasswordKeys.submit));
        await spec.tap(find.byKey(ChangePasswordKeys.submit));
      });

      await spec.then('nothing is changed and it says so', () async {
        await spec.eventually(find.byKey(ChangePasswordKeys.wrong));
      });

      await spec.when('the right one is offered', () async {
        await spec.type(find.byKey(ChangePasswordKeys.current), first,
            clear: true);
        await spec.scrollTo(find.byKey(ChangePasswordKeys.submit));
        await spec.tap(find.byKey(ChangePasswordKeys.submit));
        await spec.eventually(find.byKey(SettingsKeys.changePassword));
      });

      await spec.when('the app is closed and reopened', () async {
        await spec.restart(ReflektApp(storageDirectory: spec.storageDirectory));
        await spec.eventually(find.byKey(UnlockKeys.field));
      });

      await spec.then('the old password no longer opens it', () async {
        await spec.type(find.byKey(UnlockKeys.field), first);
        await spec.tap(find.byKey(UnlockKeys.submit));
        await spec.eventually(find.byKey(UnlockKeys.error));
      });

      await spec.when('the new password is offered', () async {
        await spec.type(find.byKey(UnlockKeys.field), second, clear: true);
        await spec.tap(find.byKey(UnlockKeys.submit));
      });

      await spec.then('everything written before is still there', () async {
        await spec.eventually(find.text(note));
      });
    },
  );
}
