import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';
import 'package:reflekt/features/settings/settings_page.dart';

import '_spec.dart';

/// SPEC — Keep a copy of your journal
///
/// The journal is encrypted with a key derived from a password nobody can
/// recover (ADR-0006). Until now that meant a forgotten password, a lost phone
/// or a bad tap took everything with it — there was no way to get anything out
/// at all.
///
/// The file is plaintext JSON on purpose (ADR-0011): an export only this app
/// can read is a backup, and backup is a different feature. The screen says so
/// where the button is, because the journal is encrypted right up until this
/// point and then it is not.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * choosing where the file goes — it is written somewhere reachable, and a
///     save dialog needs a plugin
///   * encrypted exports, which ADR-0011 defers
///   * importing a file written by the PWA
void main() {
  // Settings carries several scrollables. Naming the page is the difference
  // between scrolling it and scrolling the model list inside it.
  const password = 'a good password';
  const entry = 'The sourdough finally rose properly.';

  runSpec(
    'Keep a copy of your journal',
    body: (spec) async {
      await spec.launch(ReflektApp(storageDirectory: spec.storageDirectory));

      await spec.given('a journal with something in it', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), password);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.addNote));

        await spec.tap(find.byKey(JournalHomeKeys.addNote));
        await spec.type(find.byKey(NoteComposerKeys.field), entry);
        await spec.tap(find.byKey(NoteComposerKeys.save));
        await spec.eventually(find.text(entry));
      });

      await spec.when('a copy is written out', () async {
        await spec.tap(find.byKey(JournalHomeKeys.settings));
        await spec.eventually(find.byKey(SettingsKeys.apiKeyField));
        await spec.scrollTo(find.byKey(SettingsKeys.export));
        await spec.tap(find.byKey(SettingsKeys.export));
      });

      await spec.then('the journal says where it put it', () async {
        // Reached for rather than waited on: Settings is a list, so a line
        // below the fold is not merely unseen — it is not in the tree at all,
        // and waiting for it would wait forever.
        await spec.scrollTo(find.byKey(SettingsKeys.archiveSaid));
        expect(find.textContaining('reflekt-journal.json'), findsOneWidget);
      });

      await spec.when('the note is erased', () async {
        await spec.tester.pageBack();
        await spec.eventually(find.text(entry));
        await spec.tap(find.text(entry));
        await spec.eventually(find.byKey(NoteComposerKeys.delete));
        await spec.tap(find.byKey(NoteComposerKeys.delete));
        await spec.eventually(find.byKey(JournalHomeKeys.emptyState));
      });

      await spec.when('the copy is brought back in', () async {
        await spec.tap(find.byKey(JournalHomeKeys.settings));
        await spec.eventually(find.byKey(SettingsKeys.apiKeyField));
        await spec.scrollTo(find.byKey(SettingsKeys.import));
        await spec.tap(find.byKey(SettingsKeys.import));
        await spec.scrollTo(find.byKey(SettingsKeys.archiveSaid));
      });

      await spec.then('the writing is there again', () async {
        await spec.tester.pageBack();
        await spec.eventually(find.text(entry));
      });
    },
  );
}
