import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';

import '_spec.dart';

/// SPEC — Journal a note
///
/// A person can capture a thought and see it on today's journal.
///
/// This file is the specification for the feature; there is no separate spec
/// document. Running it produces `evidence/journal-a-note.gif`, so the spec,
/// the verification, and the evidence are the same artefact and cannot drift
/// apart.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * surviving a restart — notes are in memory until persistence lands
///     (ADR-0002)
///   * editing or deleting a note
///   * more than one note per day
void main() {
  const noteText = 'Shipped the Flutter foundation today.';

  TextButton saveButton(Spec spec) =>
      spec.tester.widget<TextButton>(find.byKey(NoteComposerKeys.save));

  runSpec(
    'Journal a note',
    body: (spec) async {
      await spec.launch(const ReflektApp());

      await spec.given("today's journal has nothing written in it", () async {
        expect(find.text('Reflekt'), findsOneWidget);
        expect(find.byKey(JournalHomeKeys.emptyState), findsOneWidget);
      });

      await spec.when('the composer is opened', () async {
        await spec.tap(find.byKey(JournalHomeKeys.addNote));
      });

      await spec.then('an empty note is offered to write in', () async {
        expect(find.byKey(NoteComposerKeys.field), findsOneWidget);
      });

      await spec.and('saving is refused while nothing has been written',
          () async {
        expect(saveButton(spec).onPressed, isNull);
      });

      await spec.when('a note is written', () async {
        await spec.type(find.byKey(NoteComposerKeys.field), noteText);
      });

      await spec.then('saving becomes available', () async {
        expect(saveButton(spec).onPressed, isNotNull);
      });

      await spec.when('the note is saved', () async {
        await spec.tap(find.byKey(NoteComposerKeys.save));
      });

      await spec.then("the note appears on today's journal", () async {
        expect(find.byKey(JournalHomeKeys.noteList), findsOneWidget);
        expect(find.text(noteText), findsOneWidget);
      });

      await spec.and('the journal no longer looks empty', () async {
        expect(find.byKey(JournalHomeKeys.emptyState), findsNothing);
      });
    },
  );
}
