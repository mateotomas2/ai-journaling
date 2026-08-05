import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';

/// Text that was written, rendered as it was meant to read.
///
/// Markdown, because the assistant writes it by habit — lists, emphasis,
/// the occasional heading — and rendering it literally puts asterisks and
/// hashes into someone's journal. A person typing plain prose sees no
/// difference, which is the point: nothing here asks them to know what
/// markdown is.
///
/// The composer stays a plain field. Writing a note is one action, and a
/// preview toggle would make it two.
class WrittenText extends StatelessWidget {
  const WrittenText(this.text, {super.key, required this.style});

  final String text;

  /// The face this is set in — the serif for what the person wrote, the sans
  /// for what the assistant said (ADR-0008).
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return MarkdownBody(
      data: text,
      // Selectable would be better and is not free: it swallows the tap that
      // opens a note for editing. Reading comes first here.
      styleSheet: MarkdownStyleSheet.fromTheme(theme).copyWith(
        p: style,
        listBullet: style,
        // Headings inside a journal entry are someone organising a thought,
        // not chapters. Kept close to body size so a note with one does not
        // shout across the day.
        h1: style?.copyWith(fontWeight: FontWeight.w600, height: 1.3),
        h2: style?.copyWith(fontWeight: FontWeight.w600, height: 1.3),
        h3: style?.copyWith(fontWeight: FontWeight.w600, height: 1.3),
        blockquote: style?.copyWith(color: theme.colorScheme.onSurfaceVariant),
        code: style?.copyWith(
          fontFamily: 'monospace',
          fontSize: (style?.fontSize ?? 16) * 0.92,
          backgroundColor: theme.colorScheme.surfaceContainerHighest,
        ),
        codeblockDecoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(8),
        ),
        blockSpacing: 10,
      ),
    );
  }
}
