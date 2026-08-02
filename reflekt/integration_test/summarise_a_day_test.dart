import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/ai/journal_ai.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';
import 'package:reflekt/features/lock/unlock_page.dart';

import '_spec.dart';

/// SPEC — Summarise a day
///
/// Days accumulate scattered notes. A summary is the version you would actually
/// reread later.
///
/// It is written down once and kept, so returning to a day does not quietly
/// spend money again — the spec proves that by counting how many times the AI
/// was asked.
///
/// As in the ask spec, the AI is injected and answers from a script. What this
/// demonstrates is the app's behaviour around a summary, not the quality of
/// any model's writing.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * regenerating a summary after the day's notes change — the stored one
///     goes stale and nothing yet notices, which is a real gap and its own
///     decision
///   * the sectioned summaries the PWA produces (journal, insights, health,
///     dreams); one plain summary first
void main() {
  const password = 'a good password';
  const entry = 'Walked the long way home and stopped at the bridge.';
  const summary = 'A quiet day, with a longer walk home and a pause at the '
      'bridge.';

  final ai = _CountingAi(summary);

  runSpec(
    'Summarise a day',
    body: (spec) async {
      await spec.launch(
        ReflektApp(storageDirectory: spec.storageDirectory, ai: ai),
      );

      await spec.given('a day with something written on it', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), password);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.addNote));

        await spec.tap(find.byKey(JournalHomeKeys.addNote));
        await spec.type(find.byKey(NoteComposerKeys.field), entry);
        await spec.tap(find.byKey(NoteComposerKeys.save));
        await spec.eventually(find.text(entry));
      });

      await spec.when('a summary is asked for', () async {
        await spec.tap(find.byKey(JournalHomeKeys.summarise));
      });

      await spec.then('the day is summarised', () async {
        await spec.eventually(find.text(summary));
      });

      await spec.and('the notes are still there beneath it', () async {
        // A summary stands alongside the writing, never in place of it.
        expect(find.text(entry), findsOneWidget);
      });

      await spec.when('the app is closed, reopened and unlocked', () async {
        await spec.restart(
          ReflektApp(storageDirectory: spec.storageDirectory, ai: ai),
        );
        await spec.type(find.byKey(UnlockKeys.field), password);
        await spec.tap(find.byKey(UnlockKeys.submit));
      });

      await spec.then('the summary is still there', () async {
        await spec.eventually(find.text(summary));
      });

      await spec.and('it was not paid for a second time', () async {
        expect(ai.timesSummarised, 1);
      });
    },
  );
}

/// Answers from a script and counts how often it was asked, so the spec can
/// prove a stored summary is reused rather than quietly regenerated.
class _CountingAi implements JournalAi {
  _CountingAi(this.summary);

  final String summary;
  int timesSummarised = 0;

  @override
  Future<String> summarise({required List<String> entries}) async {
    timesSummarised++;
    await Future<void>.delayed(const Duration(milliseconds: 700));
    return summary;
  }

  @override
  Future<String> ask({
    required String question,
    required List<String> entries,
  }) async =>
      throw UnimplementedError('not part of this spec');
}
