---
status: accepted
---

# The journal key comes from a password, not from signing in with Google

Signing in with Google was proposed as the whole authentication story — no
password, and Drive backup for free. It cannot be: OAuth gives identity, not key
material. Tokens rotate and are readable by the account holder, so anything
derived from them is readable by anyone who reaches the Google account, and by
Google.

Three properties are wanted, and only two are ever available at once: no
password, restore on a new device, and Google being unable to read the journal.

* **Key in the Drive `appDataFolder`** — no password, restores anywhere, but
  Google and anyone who compromises the account can decrypt. Not end-to-end.
* **Key in the Android Keystore** — no password, unreadable by Google, but
  non-exportable *by design*. The journal dies with the device: Keystore entries
  are deleted on app uninstall and can be invalidated by enrolling a new
  fingerprint, and a Drive backup encrypted with such a key could never be
  decrypted by anything. It would be permanent noise.
* **Key derived from a user-held secret** — restores anywhere, unreadable by
  Google, at the cost of a secret the user must keep.

We take the third. A journal holds health and dream entries, so a reused Gmail
password or a hijacked session must not expose it, and losing everything to an
app reinstall is not an acceptable failure mode for years of personal writing.

## Decisions

- **Key derivation is Argon2id** with a random per-user salt, stored locally and
  embedded in any backup. Parameters follow OWASP mobile guidance (m=64 MiB,
  t=3, p=2). The PWA's PBKDF2-with-a-fixed-salt is deliberately not copied: a
  single salt across every user means one precomputation attacks the whole
  userbase, and its stated reason — avoiding an envelope — is not a real cost,
  since a salt is not secret and lives next to the ciphertext.
- **Biometrics cannot be the root.** `BiometricPrompt` gates *use* of a Keystore
  key; fingerprint data never leaves the TEE and yields nothing derivable. It
  unlocks a wrapped copy of the key on a device that has already been set up,
  which is a convenience, not an authentication factor we can rebuild from.
- **The journal locks on every cold start and after 3 minutes backgrounded.**
  The key is held in memory only. The timeout is injectable so specs can use a
  short one and stay watchable.
- Google sign-in remains in scope only for **Backup** (ADR-0004), and gains no
  ability to read journal content.

## Consequences

A forgotten password means unrecoverable data, with no reset path — that is what
"Google cannot read it" costs, and it must be said plainly in the setup screen
rather than buried. A recovery-code model (a generated phrase the user stores
once) was considered as a friendlier root secret and rejected for now in favour
of matching the mental model users already have.

Choosing a user-held secret also reopens PWA interoperability, which ADR-0004
had given up — though the KDF change means it is no longer byte-compatible
without a migration.
