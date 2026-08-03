import 'package:flutter/material.dart';

import 'core/clock.dart';
import 'features/ai/journal_ai.dart';

import 'features/journal/journal_home_page.dart';
import 'features/lock/journal_session.dart';
import 'features/lock/forgotten_password_page.dart';
import 'features/lock/set_password_page.dart';
import 'features/lock/unlock_page.dart';
import 'theme/journal_theme.dart';

/// Root of the Reflekt app.
class ReflektApp extends StatefulWidget {
  const ReflektApp({
    super.key,
    this.lockAfter = const Duration(minutes: 3),
    this.storageDirectory,
    this.clock = systemClock,
    this.ai,
  });

  /// How long backgrounded before the journal re-locks (ADR-0006).
  final Duration lockAfter;

  /// Test seam so a spec can point at a scratch directory.
  final String? storageDirectory;

  /// Where the app reads "now". Injected so a spec can roll the day over
  /// instead of waiting until tomorrow.
  final Clock clock;

  /// Injected so specs answer from a script instead of calling OpenRouter.
  /// When null the app builds a real client from the saved key.
  final JournalAi? ai;

  @override
  State<ReflektApp> createState() => _ReflektAppState();
}

class _ReflektAppState extends State<ReflektApp> {
  late final JournalSession _session;
  bool _biometricReady = false;
  final _navigator = GlobalKey<NavigatorState>();

  @override
  void initState() {
    super.initState();
    _session = JournalSession(
      lockAfter: widget.lockAfter,
      overrideDirectory: widget.storageDirectory,
    );
    _session.start();
    _checkBiometrics();
  }

  /// Whether to offer a fingerprint at all. Both must hold: the device can do
  /// it, and this journal has a key stored. Offering it otherwise would be a
  /// button that cannot work.
  Future<void> _checkBiometrics() async {
    final ready = await _session.biometrics.isAvailable &&
        await _session.biometrics.isEnabled;
    if (mounted) setState(() => _biometricReady = ready);
  }

  @override
  void dispose() {
    _session.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: _navigator,
      title: 'Reflekt',
      debugShowCheckedModeBanner: false,
      // Light is the designed mode (ADR-0008); dark is its own reading of the
      // same palette rather than an inversion. Which one shows is the phone's
      // business — someone writing at night has already told it.
      theme: JournalTheme.light,
      darkTheme: JournalTheme.dark,
      themeMode: ThemeMode.system,
      home: ListenableBuilder(
        listenable: _session,
        builder: (context, _) => switch (_session.state) {
          JournalLockState.starting =>
            const Scaffold(body: Center(child: CircularProgressIndicator())),
          JournalLockState.needsPassword =>
            SetPasswordPage(onChosen: _session.createJournal),
          JournalLockState.locked => UnlockPage(
              onUnlock: _session.unlock,
              onBiometric:
                  _biometricReady ? _session.unlockWithBiometrics : null,
              onForgotten: () => _navigator.currentState?.push(
                MaterialPageRoute(
                  builder: (_) => ForgottenPasswordPage(
                    onClear: () async {
                      await _session.destroy();
                      _navigator.currentState?.pop();
                    },
                  ),
                ),
              ),
            ),
          JournalLockState.open =>
            JournalHomePage(
              session: _session,
              clock: widget.clock,
              ai: widget.ai,
            ),
        },
      ),
    );
  }
}
