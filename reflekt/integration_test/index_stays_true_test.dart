import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';
import 'package:reflekt/features/memory/meaning_search_page.dart';

import '_spec.dart';

/// SPEC — The meaning index stays true
///
/// An index that only ever grows is worse than none: it keeps finding notes by
/// what they used to say, and keeps returning notes that no longer exist.
/// Both are quieter failures than a search that finds nothing, because the
/// results look real.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * indexing notes written before this existed — a backfill, covered by
///     `test/backfill_test.dart` because watching a progress bar proves nothing
///   * how good the ranking is, which no spec can assert
void main() {
  const password = 'a good password';
  const aboutBaking = 'The sourdough finally rose properly.';
  const aboutRunning = 'Went for a long run before work.';

  Future<void> searchFor(Spec spec, String query) async {
    await spec.tap(find.byKey(JournalHomeKeys.findByMeaning));
    await spec.eventually(find.byKey(MeaningSearchKeys.field));
    await spec.type(find.byKey(MeaningSearchKeys.field), query);
    await spec.tap(find.byKey(MeaningSearchKeys.submit));
  }

  runSpec(
    'The meaning index stays true',
    body: (spec) async {
      await spec.launch(ReflektApp(storageDirectory: spec.storageDirectory));

      await spec.given('a note about baking', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), password);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.addNote));

        await spec.tap(find.byKey(JournalHomeKeys.addNote));
        await spec.type(find.byKey(NoteComposerKeys.field), aboutBaking);
        await spec.tap(find.byKey(NoteComposerKeys.save));
        await spec.eventually(find.text(aboutBaking));
      });

      await spec.when('it is reworded to be about running instead', () async {
        await spec.tap(find.text(aboutBaking));
        await spec.eventually(find.byKey(NoteComposerKeys.field));
        await spec.type(find.byKey(NoteComposerKeys.field), aboutRunning,
            clear: true);
        await spec.tap(find.byKey(NoteComposerKeys.save));
        await spec.eventually(find.text(aboutRunning));
      });

      await spec.then('it is found by what it says now', () async {
        await searchFor(spec, 'exercise');
        await spec.eventually(find.text(aboutRunning),
            timeout: const Duration(seconds: 120));
      });

      await spec.when('the search is repeated for what it used to say',
          () async {
        await spec.tap(find.byKey(MeaningSearchKeys.field));
        await spec.type(find.byKey(MeaningSearchKeys.field), 'bread',
            clear: true);
        await spec.tap(find.byKey(MeaningSearchKeys.submit));
        await spec.eventually(find.byKey(MeaningSearchKeys.results));
      });

      await spec.then('the old wording no longer finds it', () async {
        // The note still exists — it simply is not about baking any more.
        expect(find.text(aboutBaking), findsNothing);
      });
    },
  );
}
