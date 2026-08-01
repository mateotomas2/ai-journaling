import 'dart:convert';
import 'dart:math';

import 'package:cryptography/cryptography.dart';

/// Derives the key that encrypts the journal database.
///
/// Argon2id with a random per-user salt (ADR-0006). Deliberately not the PWA's
/// PBKDF2-with-a-fixed-salt: one salt shared by every user means a single
/// precomputation attacks the whole userbase, and Argon2id's memory-hardness is
/// what makes offline GPU cracking expensive — which matters because a
/// password-derived key is exactly what an attacker grinds on.
class JournalKey {
  const JournalKey._();

  /// OWASP mobile guidance for Argon2id. Raising these is safe; lowering them
  /// weakens every key derived afterwards, and old keys cannot be re-derived
  /// with different parameters.
  static const memoryKiB = 65536; // 64 MiB
  static const iterations = 3;
  static const parallelism = 2;
  static const _keyLengthBytes = 32; // AES-256 / SQLCipher raw key

  /// A salt is not secret — it is stored beside the database and travels with a
  /// backup, so the same password reproduces the key on another device.
  static String newSalt() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    return base64Encode(bytes);
  }

  /// Derives the raw key for SQLCipher.
  ///
  /// Intentionally slow — that cost is the defence. Call it off the critical
  /// path of a frame.
  static Future<String> derive({
    required String password,
    required String salt,
  }) async {
    final algorithm = Argon2id(
      memory: memoryKiB,
      iterations: iterations,
      parallelism: parallelism,
      hashLength: _keyLengthBytes,
    );

    final secretKey = await algorithm.deriveKey(
      secretKey: SecretKey(utf8.encode(password)),
      nonce: base64Decode(salt),
    );
    final bytes = await secretKey.extractBytes();

    // SQLCipher takes a raw key as 64 hex characters via `PRAGMA key = "x'…'"`.
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }
}
