/// Decides *when* the journal should re-lock. Knows nothing about keys,
/// databases or widgets.
///
/// Split out from [JournalSession] so the rule can be tested without an
/// encrypted database or a device: the policy is the part with edge cases, and
/// entangling it with SQLCipher meant it could only be exercised somewhere it
/// could barely be observed.
class LockPolicy {
  LockPolicy({
    required this.lockAfter,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  /// How long the app may be away before the journal closes itself.
  final Duration lockAfter;

  final DateTime Function() _clock;
  DateTime? _leftAt;

  /// The app went to the background.
  void left() => _leftAt = _clock();

  /// The app came back. Returns true when the journal should re-lock.
  ///
  /// Returns false when the app was never recorded as leaving — a resume with
  /// no matching pause is not evidence that time passed.
  bool shouldLockOnReturn() {
    final leftAt = _leftAt;
    _leftAt = null;
    if (leftAt == null) return false;
    return _clock().difference(leftAt) >= lockAfter;
  }
}
