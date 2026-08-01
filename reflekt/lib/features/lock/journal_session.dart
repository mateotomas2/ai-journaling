import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../../db/journal_database.dart';
import 'journal_key.dart';

enum JournalLockState {
  /// Still working out whether a password has ever been set.
  starting,

  /// No password yet — first run.
  needsPassword,

  /// A password exists and the journal is closed.
  locked,

  /// Unlocked; [JournalSession.database] is usable.
  open,
}

/// Owns the journal's key for as long as it is unlocked, and nothing longer.
///
/// Deliberately **not** a singleton. One session belongs to one running app, so
/// rebuilding the widget tree — which is what a restart looks like to a spec —
/// produces a fresh, locked session. A global would keep the key alive across a
/// restart and make a persistence spec pass without proving anything.
///
/// The key lives in memory only. The salt beside it is not secret (ADR-0006):
/// it is stored in the clear so the same password reproduces the key here or on
/// another device restoring a backup.
class JournalSession extends ChangeNotifier with WidgetsBindingObserver {
  JournalSession({
    this.lockAfter = const Duration(minutes: 3),
    this.overrideDirectory,
  });

  /// How long the app may sit in the background before the journal re-locks.
  /// Injectable so a spec can use a short one and stay watchable.
  final Duration lockAfter;

  /// Test seam so a spec can point at a scratch directory.
  final String? overrideDirectory;

  JournalLockState _state = JournalLockState.starting;
  JournalDatabase? _database;
  DateTime? _backgroundedAt;

  JournalLockState get state => _state;

  JournalDatabase get database {
    final db = _database;
    if (db == null) {
      throw StateError('The journal is locked; there is no database to read.');
    }
    return db;
  }

  Future<String> get _directory async =>
      overrideDirectory ?? (await getApplicationDocumentsDirectory()).path;

  Future<File> get _saltFile async =>
      File(p.join(await _directory, 'journal.salt'));

  /// Works out whether this device has a journal yet.
  Future<void> start() async {
    WidgetsBinding.instance.addObserver(this);
    final salt = await _saltFile;
    _state = await salt.exists()
        ? JournalLockState.locked
        : JournalLockState.needsPassword;
    notifyListeners();
  }

  /// First run: choose the password the journal will be encrypted with.
  Future<void> createJournal(String password) async {
    final salt = JournalKey.newSalt();
    final rawKey = await JournalKey.derive(password: password, salt: salt);

    _database = await openJournalDatabase(
      rawKey: rawKey,
      overrideDirectory: overrideDirectory,
    );
    // Written only after the database opens, so a failure part-way through does
    // not leave a salt claiming a journal that was never created.
    await (await _saltFile).writeAsString(salt);

    _state = JournalLockState.open;
    notifyListeners();
  }

  /// Returns false when the password does not open the journal.
  Future<bool> unlock(String password) async {
    final salt = await (await _saltFile).readAsString();
    final rawKey = await JournalKey.derive(password: password, salt: salt);
    try {
      _database = await openJournalDatabase(
        rawKey: rawKey,
        overrideDirectory: overrideDirectory,
      );
    } on WrongPasswordException {
      return false;
    }
    _state = JournalLockState.open;
    notifyListeners();
    return true;
  }

  Future<void> lock() async {
    final db = _database;
    _database = null;
    _state = JournalLockState.locked;
    notifyListeners();
    await db?.close();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_state != JournalLockState.open) return;

    if (state == AppLifecycleState.resumed) {
      final since = _backgroundedAt;
      _backgroundedAt = null;
      if (since != null && DateTime.now().difference(since) >= lockAfter) {
        lock();
      }
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      _backgroundedAt = DateTime.now();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _database?.close();
    super.dispose();
  }
}
