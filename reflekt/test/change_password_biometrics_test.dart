import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/features/lock/biometric_unlock.dart';
import 'package:reflekt/features/lock/journal_session.dart';

/// What changing a password does to a stored fingerprint key.
///
/// This exists because the behaviour was claimed in a PR and was not in the
/// code — an edit landed on a branch where `changePassword` did not yet exist,
/// matched nothing, and said so to nobody. The assertion guarding it was too
/// loose to notice, because the string it looked for appeared elsewhere in the
/// file.
///
/// A test asserts the behaviour rather than the text, which is the difference.
void main() {
  // JournalSession registers a lifecycle observer on start, which needs a
  // binding.
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory dir;

  setUp(() => dir = Directory.systemTemp.createTempSync('reflekt-bio-change'));
  tearDown(() => dir.deleteSync(recursive: true));

  test('changing the password forgets the stored fingerprint key', () async {
    final vault = _MemoryVault();
    final session = JournalSession(
      overrideDirectory: dir.path,
      biometrics: BiometricUnlock(prompt: _AlwaysAllows(), vault: vault),
    );

    await session.start();
    try {
      await session.createJournal('the first password');
    } catch (error) {
      if (!error.toString().contains('Failed to load dynamic library')) rethrow;
      return markTestSkipped('SQLCipher unavailable here');
    }

    await session.enableBiometrics('the first password');
    expect(await vault.read(), isNotNull, reason: 'setup did not take');

    await session.changePassword(
      current: 'the first password',
      replacement: 'the second password',
    );

    // The old key decrypts nothing now. Keeping it means the next fingerprint
    // unlock fails for a reason nobody can see.
    expect(await vault.read(), isNull);
  });
}

class _AlwaysAllows implements BiometricPrompt {
  @override
  Future<bool> get isAvailable async => true;
  @override
  Future<bool> confirm(String reason) async => true;
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
