import 'package:flutter/material.dart';

import 'core/clock.dart';
import 'features/ai/journal_ai.dart';

import 'features/journal/journal_home_page.dart';
import 'features/lock/journal_session.dart';
import 'features/lock/set_password_page.dart';
import 'features/lock/unlock_page.dart';

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

  @override
  void initState() {
    super.initState();
    _session = JournalSession(
      lockAfter: widget.lockAfter,
      overrideDirectory: widget.storageDirectory,
    );
    _session.start();
  }

  @override
  void dispose() {
    _session.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF4C6EF5),
      brightness: Brightness.dark,
    );

    return MaterialApp(
      title: 'Reflekt',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(colorScheme: scheme, useMaterial3: true),
      home: ListenableBuilder(
        listenable: _session,
        builder: (context, _) => switch (_session.state) {
          JournalLockState.starting =>
            const Scaffold(body: Center(child: CircularProgressIndicator())),
          JournalLockState.needsPassword =>
            SetPasswordPage(onChosen: _session.createJournal),
          JournalLockState.locked => UnlockPage(onUnlock: _session.unlock),
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
