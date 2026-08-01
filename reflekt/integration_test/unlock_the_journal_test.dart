import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';
import 'package:reflekt/features/lock/unlock_page.dart';

import '_spec.dart';

/// SPEC — Unlock the journal
///
/// The journal is protected by a password only its owner knows. Signing in with
/// Google would say *which* Drive to write to; it would say nothing about who
/// may read what is in it. Keeping the two apart is what stops a compromised
/// Google account from being a compromised journal (ADR-0006).
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * biometric unlock — it wraps this same key on a device already set up,
///     and ships as its own slice
///   * re-locking after a spell in the background — specified separately, since
///     it needs lifecycle control this spec does not
///   * changing or recovering a password: there is deliberately no recovery,
///     because a key Google cannot read is a key nobody can reset
void main() {
  const password = 'correct horse battery staple';
  const wrongPassword = 'not the password';

  runSpec(
    'Unlock the journal',
    body: (spec) async {
      await spec.launch(ReflektApp(storageDirectory: spec.storageDirectory));

      await spec.given('a first run, which asks for a password', () async {
        expect(find.byKey(SetPasswordKeys.field), findsOneWidget);
      });

      await spec.when('a password is chosen', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), password);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
      });

      await spec.then('the journal opens', () async {
        await spec.eventually(find.byKey(JournalHomeKeys.emptyState));
      });

      await spec.when('the app is closed and reopened', () async {
        await spec.restart(ReflektApp(storageDirectory: spec.storageDirectory));
      });

      await spec.then('the journal is locked', () async {
        await spec.eventually(find.byKey(UnlockKeys.field));
        expect(find.byKey(JournalHomeKeys.emptyState), findsNothing);
      });

      await spec.when('the wrong password is offered', () async {
        await spec.type(find.byKey(UnlockKeys.field), wrongPassword);
        await spec.tap(find.byKey(UnlockKeys.submit));
      });

      await spec.then('it stays locked and says so', () async {
        await spec.eventually(find.byKey(UnlockKeys.error));
        expect(find.byKey(JournalHomeKeys.emptyState), findsNothing);
      });

      await spec.when('the right password is offered', () async {
        await spec.type(find.byKey(UnlockKeys.field), password, clear: true);
        await spec.tap(find.byKey(UnlockKeys.submit));
      });

      await spec.then('the journal opens', () async {
        await spec.eventually(find.byKey(JournalHomeKeys.emptyState));
      });
    },
  );
}
