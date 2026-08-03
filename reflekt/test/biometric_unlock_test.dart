import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/features/lock/biometric_unlock.dart';

/// Biometric unlock, minus the prompt.
///
/// **This cannot be a spec.** `BiometricPrompt` is system UI: a spec cannot tap
/// it or assert on it, and enrolling a fingerprint on an emulator means driving
/// Settings through `adb input`. So the prompt itself is checked by hand, and
/// what is testable — when a key is handed back, and when it is thrown away —
/// is checked here. Same reasoning as `LockPolicy` in #6.
///
/// The cases that matter are the refusals. A biometric unlock that hands back a
/// key it should not is worth more attention than one that works.
void main() {
  late _FakePrompt auth;
  late BiometricUnlock biometrics;

  setUp(() {
    auth = _FakePrompt();
    biometrics = BiometricUnlock(prompt: auth, vault: _MemoryVault());
  });

  test('returns nothing when it was never set up', () async {
    auth.willSucceed = true;
    expect(await biometrics.unlock(), isNull);
    // And must not have prompted: asking for a fingerprint to unlock something
    // that was never enrolled trains people to approve prompts blindly.
    expect(auth.prompted, isFalse);
  });

  test('returns nothing when the prompt is refused', () async {
    await biometrics.enable('deadbeef');
    auth.willSucceed = false;
    expect(await biometrics.unlock(), isNull);
  });

  test('hands back the key when the prompt succeeds', () async {
    await biometrics.enable('deadbeef');
    auth.willSucceed = true;
    expect(await biometrics.unlock(), 'deadbeef');
  });

  test('turning it off forgets the key', () async {
    await biometrics.enable('deadbeef');
    await biometrics.disable();
    auth.willSucceed = true;

    expect(await biometrics.unlock(), isNull);
    expect(await biometrics.isEnabled, isFalse);
  });

  test('a refused prompt leaves it set up', () async {
    // Failing once must not silently turn the feature off — that would look
    // like the setting resetting itself for no reason.
    await biometrics.enable('deadbeef');
    auth.willSucceed = false;
    await biometrics.unlock();

    expect(await biometrics.isEnabled, isTrue);
  });
}

class _FakePrompt implements BiometricPrompt {
  bool willSucceed = false;
  bool prompted = false;

  @override
  Future<bool> get isAvailable async => true;

  @override
  Future<bool> confirm(String reason) async {
    prompted = true;
    return willSucceed;
  }
}

class _MemoryVault implements KeyVault {
  String? _value;

  @override
  Future<String?> read() async => _value;

  @override
  Future<void> write(String value) async => _value = value;

  @override
  Future<void> clear() async => _value = null;
}
