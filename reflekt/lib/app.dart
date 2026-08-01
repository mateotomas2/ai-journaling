import 'package:flutter/material.dart';

import 'features/journal/journal_home_page.dart';

/// Root of the Reflekt app.
///
/// Scope note: this is the foundation shell (ADR-0001). Local persistence
/// (ADR-0002, Drift + SQLCipher) is not wired up yet, so journal state lives
/// in memory only and is lost on restart.
class ReflektApp extends StatelessWidget {
  const ReflektApp({super.key});

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
      home: const JournalHomePage(),
    );
  }
}
