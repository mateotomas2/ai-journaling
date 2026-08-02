import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/features/lock/lock_policy.dart';

/// When the journal re-locks (ADR-0006).
///
/// Verified here rather than as a recorded spec: the interesting moment happens
/// while the app is in the background, so a video of it shows a blank screen.
/// The behaviour still has to be proven — it just has nothing to watch.
///
/// The clock is injected, so these assert the rule rather than waiting on it.
void main() {
  const timeout = Duration(minutes: 3);
  final start = DateTime(2026, 8, 1, 9);

  LockPolicy policyAt(DateTime Function() clock) =>
      LockPolicy(lockAfter: timeout, clock: clock);

  test('re-locks after being away longer than the timeout', () {
    var now = start;
    final policy = policyAt(() => now);

    policy.left();
    now = start.add(timeout + const Duration(seconds: 1));

    expect(policy.shouldLockOnReturn(), isTrue);
  });

  test('stays open when away only briefly', () {
    // The direction that is easy to forget. Without it, an app that locked the
    // instant it lost focus would look correct — and would be unusable, since
    // glancing at a message mid-entry would cost you your password.
    var now = start;
    final policy = policyAt(() => now);

    policy.left();
    now = start.add(const Duration(seconds: 20));

    expect(policy.shouldLockOnReturn(), isFalse);
  });

  test('re-locks exactly at the timeout, not a moment later', () {
    var now = start;
    final policy = policyAt(() => now);

    policy.left();
    now = start.add(timeout);

    expect(policy.shouldLockOnReturn(), isTrue);
  });

  test('a return with no matching departure does not lock', () {
    // Android delivers lifecycle events that do not always pair up. Treating an
    // unexplained resume as "time passed" would lock people out at random.
    expect(policyAt(() => start).shouldLockOnReturn(), isFalse);
  });

  test('each departure is judged on its own', () {
    var now = start;
    final policy = policyAt(() => now);

    policy.left();
    now = start.add(timeout + const Duration(minutes: 1));
    expect(policy.shouldLockOnReturn(), isTrue);

    // A long absence must not leave the policy primed to lock on the next
    // short one.
    policy.left();
    now = now.add(const Duration(seconds: 5));
    expect(policy.shouldLockOnReturn(), isFalse);
  });
}
