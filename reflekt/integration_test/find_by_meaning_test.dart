import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';
import 'package:reflekt/features/journal/search_page.dart';

import '_spec.dart';

/// SPEC — Find a note by what it meant
///
/// Text search finds a word you remember. This finds an entry you can only
/// half describe — which is the thing that makes a long journal worth keeping,
/// because by then you rarely remember the wording.
///
/// It runs entirely on the device (ADR-0003): journal text is not sent anywhere
/// to be indexed.
///
/// **What this spec cannot prove.** That the embeddings are correct. A wrong
/// tokenizer produces vectors that are plausible, confidently ranked and
/// meaningless — and would still pass a single hand-picked example, because
/// almost any embedding beats random on one. That is checked instead by
/// `test/word_piece_test.dart`, against fixtures from the reference tokenizer.
/// This spec proves the feature is wired up and reaches the right note.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * indexing notes written before this existed — a backfill, see #14
///   * ranking quality beyond "the right one comes first"
void main() {
  const password = 'a good password';
  const running = 'Went for a long run before work and felt clearer after.';
  const bread = 'The sourdough finally rose properly.';

  runSpec(
    'Find a note by what it meant',
    body: (spec) async {
      await spec.launch(ReflektApp(storageDirectory: spec.storageDirectory));

      Future<void> write(String text) async {
        await spec.tap(find.byKey(JournalHomeKeys.addNote));
        await spec.type(find.byKey(NoteComposerKeys.field), text);
        await spec.tap(find.byKey(NoteComposerKeys.save));
        await spec.eventually(find.text(text));
      }

      await spec.given('two notes about quite different things', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), password);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.addNote));

        await write(running);
        await write(bread);
      });

      await spec.when('the journal is asked about exercise', () async {
        // Shares no words with the note it should find.
        await spec.tap(find.byKey(JournalHomeKeys.search));
        await spec.eventually(find.byKey(SearchKeys.field));
        await spec.tap(find.byKey(SearchKeys.byMeaning));
        await spec.type(find.byKey(SearchKeys.field), 'exercise');
        // Tapped rather than sending a submit action: typing goes straight to
        // EditableTextState, so there is no platform text-input connection for
        // an action to travel down.
        await spec.tap(find.byKey(SearchKeys.submit));
      });

      await spec.then('the note about running comes back', () async {
        await spec.eventually(find.text(running), timeout: const Duration(seconds: 180));
      });

      await spec.and('the one about baking does not', () async {
        expect(find.text(bread), findsNothing);
      });

      await spec.when('a result is opened', () async {
        await spec.tap(find.text(running));
      });

      await spec.then('the journal is showing that day', () async {
        await spec.eventually(find.byKey(JournalHomeKeys.noteList));
      });
    },
  );
}
