import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';
import 'package:reflekt/features/lock/unlock_page.dart';
import 'package:reflekt/features/settings/settings_page.dart';

import '_spec.dart';

/// SPEC — Set up the AI
///
/// The AI features need an OpenRouter key, which is the user's own credential
/// and can spend their money. It is kept in the encrypted journal database, so
/// it is readable only while the journal is unlocked — a key that outlived the
/// lock would be a way to run up a bill without knowing the password.
///
/// Once saved it is never shown again in full. Displaying it would put a live
/// credential on screen every time someone opens settings, and there is no
/// reason to read it back.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * checking the key against OpenRouter — a spec must not depend on the
///     network, and validity is not knowable offline
///   * choosing a model, or anything else that belongs to using the AI rather
///     than configuring it
void main() {
  const password = 'a good password';
  const apiKey = 'sk-or-v1-0123456789abcdef';

  runSpec(
    'Set up the AI',
    body: (spec) async {
      await spec.launch(ReflektApp(storageDirectory: spec.storageDirectory));

      await spec.given('an unlocked journal with no AI set up', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), password);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.addNote));

        await spec.tap(find.byKey(JournalHomeKeys.settings));
        await spec.eventually(find.byKey(SettingsKeys.apiKeyField));
        expect(find.byKey(SettingsKeys.connected), findsNothing);
      });

      await spec.when('an OpenRouter key is saved', () async {
        await spec.type(find.byKey(SettingsKeys.apiKeyField), apiKey);
        await spec.tap(find.byKey(SettingsKeys.save));
      });

      await spec.then('the journal reports the AI is ready', () async {
        await spec.eventually(find.byKey(SettingsKeys.connected));
      });

      await spec.and('the key itself is never shown again', () async {
        expect(find.text(apiKey), findsNothing);
        // Only enough to recognise which key was used.
        expect(find.textContaining('abcdef'), findsOneWidget);
      });

      await spec.when('the app is closed, reopened and unlocked', () async {
        await spec.restart(ReflektApp(storageDirectory: spec.storageDirectory));
        await spec.type(find.byKey(UnlockKeys.field), password);
        await spec.tap(find.byKey(UnlockKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.settings));
        await spec.tap(find.byKey(JournalHomeKeys.settings));
      });

      await spec.then('the AI is still set up', () async {
        await spec.eventually(find.byKey(SettingsKeys.connected));
      });
    },
  );
}
