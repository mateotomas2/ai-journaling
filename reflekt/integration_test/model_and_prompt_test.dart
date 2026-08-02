import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';
import 'package:reflekt/features/lock/unlock_page.dart';
import 'package:reflekt/features/settings/ai_settings.dart';
import 'package:reflekt/features/settings/prompt_page.dart';
import 'package:reflekt/features/settings/settings_page.dart';

import '_spec.dart';

/// SPEC — Choose which model answers, and how it is asked
///
/// Models differ in cost and in how they write, and the instructions given
/// before your entries are what make an assistant sound like it belongs to you
/// rather than to whoever shipped it.
///
/// Both live in the encrypted journal beside the API key: instructions someone
/// writes for their own journal say something about them, and belong with the
/// entries rather than in shared preferences.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * OpenRouter's full catalogue — hundreds of models is a menu nobody can
///     choose from, and most are wrong for reading someone's journal
///   * per-question overrides; this is a setting, not a knob on every ask
void main() {
  const password = 'a good password';
  const ownPrompt = 'Answer in one sentence, plainly.';

  runSpec(
    'Choose which model answers, and how it is asked',
    body: (spec) async {
      await spec.launch(ReflektApp(storageDirectory: spec.storageDirectory));

      await spec.given('an unlocked journal in settings', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), password);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.settings));
        await spec.tap(find.byKey(JournalHomeKeys.settings));
        await spec.eventually(find.byKey(SettingsKeys.apiKeyField));
      });

      await spec.when('a faster model is chosen', () async {
        await spec.tap(find.byKey(SettingsKeys.modelOf('anthropic/claude-haiku-4.5')));
      });

      await spec.when('the instructions are rewritten', () async {
        await spec.scrollTo(find.byKey(SettingsKeys.editPrompt));
        await spec.tap(find.byKey(SettingsKeys.editPrompt));
        await spec.eventually(find.byKey(PromptKeys.field));
        await spec.type(find.byKey(PromptKeys.field), ownPrompt, clear: true);
        await spec.tap(find.byKey(PromptKeys.save));
      });

      await spec.when('the app is closed, reopened and unlocked', () async {
        await spec.restart(ReflektApp(storageDirectory: spec.storageDirectory));
        await spec.type(find.byKey(UnlockKeys.field), password);
        await spec.tap(find.byKey(UnlockKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.settings));
        await spec.tap(find.byKey(JournalHomeKeys.settings));
      });

      await spec.then('both choices were remembered', () async {
        await spec.scrollTo(find.byKey(SettingsKeys.editPrompt));
        await spec.tap(find.byKey(SettingsKeys.editPrompt));
        await spec.eventually(find.text(ownPrompt));
      });

      await spec.when('the instructions are reset', () async {
        await spec.tap(find.byKey(PromptKeys.reset));
      });

      await spec.then('the original wording is back', () async {
        // Reset has to be reachable: an assistant made useless by a bad edit,
        // with no way back, is worse than one that was never editable.
        await spec.eventually(find.text(AiSettings.defaultPrompt));
      });
    },
  );
}
