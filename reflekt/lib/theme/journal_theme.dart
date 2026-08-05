import 'package:flutter/material.dart';

/// How Reflekt looks (ADR-0008).
///
/// Two rules carry the identity, and everything else follows from them:
///
///   * **The serif is the person's voice.** Notes, and the entries someone
///     writes, are set in it. The sans face is the interface talking — labels,
///     buttons, and anything the assistant says.
///   * **Paper, not panels.** A warm ground with hairline separation, rather
///     than the elevated cards and tinted surfaces Material reaches for by
///     default. The writing is the object on screen; nothing else should look
///     like one.
///
/// Dark is designed rather than inverted. Paper has no dark equivalent, so the
/// dark scheme is a warm near-black that keeps the same ink-on-ground feeling
/// instead of turning the palette inside out.
class JournalTheme {
  const JournalTheme._();

  /// The platform's serif — Noto Serif on Android. A bundled face would be
  /// better and is the obvious follow-up; shipping one is a licensing and
  /// asset-size decision of its own, and the identity does not depend on which
  /// serif it is.
  static const serif = 'serif';

  static ThemeData get light => _build(_lightScheme);
  static ThemeData get dark => _build(_darkScheme);

  // Ink on warm paper. Terracotta carries the few things that are actions;
  // sage is the quieter accent, used where something is present but passive.
  static final _lightScheme = ColorScheme.fromSeed(
    seedColor: const Color(0xFF8C5A3C),
    brightness: Brightness.light,
  ).copyWith(
    surface: const Color(0xFFFAF6EF),
    onSurface: const Color(0xFF2E2A25),
    onSurfaceVariant: const Color(0xFF6B6459),
    surfaceContainer: const Color(0xFFF3EDE3),
    surfaceContainerHighest: const Color(0xFFEDE5D8),
    primary: const Color(0xFF8C5A3C),
    secondary: const Color(0xFF6E7B6A),
    outline: const Color(0xFFCFC4B2),
    outlineVariant: const Color(0xFFE3DACB),
  );

  static final _darkScheme = ColorScheme.fromSeed(
    seedColor: const Color(0xFF8C5A3C),
    brightness: Brightness.dark,
  ).copyWith(
    surface: const Color(0xFF17150F),
    onSurface: const Color(0xFFE8E1D6),
    onSurfaceVariant: const Color(0xFFA79E90),
    surfaceContainer: const Color(0xFF1F1C16),
    surfaceContainerHighest: const Color(0xFF262219),
    primary: const Color(0xFFD9A386),
    secondary: const Color(0xFF9DAE97),
    outline: const Color(0xFF4A4438),
    outlineVariant: const Color(0xFF322D25),
  );

  static ThemeData _build(ColorScheme scheme) {
    final text = _textTheme(scheme);

    return ThemeData(
      colorScheme: scheme,
      useMaterial3: true,
      scaffoldBackgroundColor: scheme.surface,
      textTheme: text,

      // Flat and quiet: the header names where you are, it does not announce
      // itself. Material's default tint would make it the brightest band on a
      // screen whose subject is below it.
      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
        foregroundColor: scheme.onSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: text.titleMedium,
      ),

      // A note is a piece of writing on the page, not a raised panel. Hairline
      // outline, no shadow, no elevation tint.
      cardTheme: CardThemeData(
        color: scheme.surfaceContainer,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: scheme.outlineVariant),
        ),
      ),

      listTileTheme: ListTileThemeData(
        titleTextStyle: text.bodyLarge,
        subtitleTextStyle: text.labelSmall,
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
        minVerticalPadding: 10,
      ),

      chipTheme: ChipThemeData(
        backgroundColor: Colors.transparent,
        selectedColor: scheme.secondary.withValues(alpha: 0.18),
        side: BorderSide(color: scheme.outline),
        labelStyle: text.labelLarge,
        showCheckmark: false,
        shape: const StadiumBorder(),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      ),

      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: scheme.outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: scheme.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: scheme.primary, width: 1.5),
        ),
        labelStyle: text.bodyMedium,
        hintStyle: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
      ),

      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          textStyle: text.labelLarge,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          textStyle: text.labelLarge,
          side: BorderSide(color: scheme.outline),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),

      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: scheme.primary,
        foregroundColor: scheme.onPrimary,
        elevation: 1,
        extendedTextStyle: text.labelLarge,
      ),

      dividerTheme: DividerThemeData(
        color: scheme.outlineVariant,
        space: 1,
        thickness: 1,
      ),
    );
  }

  /// The serif carries writing; the sans carries the interface.
  ///
  /// `displayLarge` is the date at the top of a day — the one piece of chrome
  /// set in the reading face, because it is the title of the page you are on.
  /// `bodyLarge` is an entry, and is the only body size tuned for reading a
  /// paragraph rather than scanning a row.
  static TextTheme _textTheme(ColorScheme scheme) {
    final base = ThemeData(brightness: scheme.brightness).textTheme;

    return base
        .copyWith(
          displayLarge: TextStyle(
            fontFamily: serif,
            fontSize: 30,
            height: 1.15,
            letterSpacing: -0.4,
            fontWeight: FontWeight.w500,
          ),
          titleLarge: TextStyle(
            fontFamily: serif,
            fontSize: 21,
            height: 1.25,
            fontWeight: FontWeight.w500,
          ),
          titleMedium: const TextStyle(
            fontSize: 17,
            height: 1.3,
            fontWeight: FontWeight.w600,
          ),

          // An entry. Long measure, loose leading, sized to be read in bed.
          bodyLarge: TextStyle(
            fontFamily: serif,
            fontSize: 17,
            height: 1.55,
            letterSpacing: 0.1,
          ),
          bodyMedium: const TextStyle(fontSize: 15, height: 1.45),
          bodySmall: TextStyle(
            fontSize: 13,
            height: 1.4,
            color: scheme.onSurfaceVariant,
          ),

          labelLarge: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.1,
          ),

          // Timestamps and category names sit under an entry and must not
          // compete with it: small, wide, quiet.
          labelSmall: TextStyle(
            fontSize: 12,
            letterSpacing: 0.6,
            fontWeight: FontWeight.w500,
            color: scheme.onSurfaceVariant,
          ),
        )
        .apply(bodyColor: scheme.onSurface, displayColor: scheme.onSurface);
  }
}
