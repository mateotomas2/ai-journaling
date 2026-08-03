import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';

/// Asking the person to prove it is them.
///
/// A seam of our own rather than a dependency on `local_auth` directly: the
/// package's surface is large and changes between majors, while this app needs
/// exactly two things from it. Faking two methods is honest; mirroring a whole
/// plugin interface to test them is not.
abstract interface class BiometricPrompt {
  Future<bool> get isAvailable;

  /// True when they proved it. False covers refusal, failure and dismissal —
  /// none of which is an error, because the password still works.
  Future<bool> confirm(String reason);
}

/// Somewhere only this app can read, protected by the platform.
abstract interface class KeyVault {
  Future<String?> read();
  Future<void> write(String value);
  Future<void> clear();
}

/// Unlocking with a fingerprint instead of typing the password.
///
/// **Biometrics cannot produce a key** (ADR-0006). `BiometricPrompt` gates
/// *use* of a stored secret; fingerprint data never leaves the TEE and yields
/// nothing derivable. So this keeps the journal's key in the platform's vault
/// and hands it back after a successful prompt.
///
/// The password stays the root secret. A device with nothing stored — a new
/// phone, a fresh install — can only be opened by typing it, which is why this
/// is a convenience and never a replacement.
class BiometricUnlock {
  const BiometricUnlock({required this.prompt, required this.vault});

  /// The real thing, on a device.
  factory BiometricUnlock.platform() => BiometricUnlock(
        prompt: _LocalAuthPrompt(LocalAuthentication()),
        vault: _SecureStorageVault(const FlutterSecureStorage()),
      );

  final BiometricPrompt prompt;
  final KeyVault vault;

  Future<bool> get isAvailable => prompt.isAvailable;

  Future<bool> get isEnabled async => await vault.read() != null;

  /// Remembers [rawKey] behind the fingerprint.
  Future<void> enable(String rawKey) => vault.write(rawKey);

  /// Forgets it — when someone turns this off, and after a password change,
  /// where the stored key would otherwise open nothing.
  Future<void> disable() => vault.clear();

  /// Prompts, and returns the key on success.
  ///
  /// Returns null when nothing was stored, or the prompt was refused. Neither
  /// is an error: falling back to the password is the ordinary path.
  Future<String?> unlock() async {
    final stored = await vault.read();
    // Asked for before prompting. Requesting a fingerprint to unlock something
    // that was never set up trains people to approve prompts without reading
    // them.
    if (stored == null) return null;

    return await prompt.confirm('Unlock your journal') ? stored : null;
  }
}

class _LocalAuthPrompt implements BiometricPrompt {
  const _LocalAuthPrompt(this._auth);

  final LocalAuthentication _auth;

  @override
  Future<bool> get isAvailable async =>
      await _auth.isDeviceSupported() && await _auth.canCheckBiometrics;

  @override
  Future<bool> confirm(String reason) => _auth.authenticate(
        localizedReason: reason,
        // Biometric only: falling back to the device PIN would mean anyone who
        // can unlock the phone can read the journal, which is exactly the
        // separation this app exists to keep.
        biometricOnly: true,
        persistAcrossBackgrounding: true,
      );
}

class _SecureStorageVault implements KeyVault {
  const _SecureStorageVault(this._storage);

  final FlutterSecureStorage _storage;
  static const _key = 'journal.wrapped_key';

  @override
  Future<String?> read() => _storage.read(key: _key);

  @override
  Future<void> write(String value) => _storage.write(key: _key, value: value);

  @override
  Future<void> clear() => _storage.delete(key: _key);
}
