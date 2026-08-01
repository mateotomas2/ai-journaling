import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';

import '_spec.dart';

/// SPEC — Notes survive a restart
///
/// A note written today is still there after the app is closed and reopened.
/// Journalling is worthless if what you write evaporates, so this is the first
/// thing persistence has to earn.
///
/// Implements ADR-0002 (Drift + SQLCipher for local storage).
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * encryption at rest — the ciphertext is not inspected here, and this
///     spec runs on the web build where SQLCipher is unavailable
///   * notes from previous days, and navigating between days
///   * editing, deleting, or syncing a note
void main() {
  const noteText = 'Written before the restart.';

  // Scoped to the journal list on purpose. A bare `find.text` also matches the
  // composer's field, which is still animating out just after a save — so it
  // would be satisfied by text that is on its way off the screen rather than
  // by a note that actually landed on the journal.
  Finder noteOnJournal(String text) => find.descendant(
        of: find.byKey(JournalHomeKeys.noteList),
        matching: find.text(text),
      );

  runSpec(
    'Notes survive a restart',
    body: (spec) async {
      await spec.launch(const ReflektApp());

      await spec.given("a note written on today's journal", () async {
        await spec.tap(find.byKey(JournalHomeKeys.addNote));
        await spec.type(find.byKey(NoteComposerKeys.field), noteText);
        await spec.tap(find.byKey(NoteComposerKeys.save));
        expect(noteOnJournal(noteText), findsOneWidget);
      });

      await spec.when('the app is closed and reopened', () async {
        await spec.restart(const ReflektApp());
      });

      await spec.then("the note is still on today's journal", () async {
        expect(noteOnJournal(noteText), findsOneWidget);
      });

      await spec.and('the journal is not offering an empty day', () async {
        expect(find.byKey(JournalHomeKeys.emptyState), findsNothing);
      });
    },
  );
}
