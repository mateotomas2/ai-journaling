import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';
import 'package:reflekt/features/lock/unlock_page.dart';

import '_spec.dart';

/// SPEC — Read an earlier day
///
/// A journal you can only read today is barely a journal: everything written
/// becomes unreachable the moment the date changes. Going back through previous
/// days is what makes the writing worth keeping.
///
/// The clock is injected so the day can roll over on demand. Waiting until
/// tomorrow is not a test strategy.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * jumping to an arbitrary date rather than stepping day by day
///   * searching across days, which is a different feature entirely
///   * writing a note onto a past day — notes are written on the day you write
///     them, and back-dating is not a decision we have made
void main() {
  const password = 'a good password';
  const yesterdaysNote = 'Something worth remembering.';

  final firstDay = DateTime(2026, 8, 1, 9, 30);
  var now = firstDay;

  runSpec(
    'Read an earlier day',
    body: (spec) async {
      await spec.launch(
        ReflektApp(
          storageDirectory: spec.storageDirectory,
          clock: () => now,
        ),
      );

      await spec.given('a note written on the 1st of August', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), password);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.addNote));

        await spec.tap(find.byKey(JournalHomeKeys.addNote));
        await spec.type(find.byKey(NoteComposerKeys.field), yesterdaysNote);
        await spec.tap(find.byKey(NoteComposerKeys.save));
        await spec.eventually(find.text(yesterdaysNote));
      });

      await spec.when('the day rolls over to the 2nd', () async {
        now = firstDay.add(const Duration(days: 1));
        await spec.restart(
          ReflektApp(
            storageDirectory: spec.storageDirectory,
            clock: () => now,
          ),
        );
        await spec.type(find.byKey(UnlockKeys.field), password);
        await spec.tap(find.byKey(UnlockKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.emptyState));
      });

      await spec.then('today is a blank page', () async {
        expect(find.text('2 August 2026'), findsOneWidget);
        expect(find.text(yesterdaysNote), findsNothing);
      });

      await spec.when('the journal is turned back a day', () async {
        await spec.tap(find.byKey(JournalHomeKeys.previousDay));
      });

      await spec.then("yesterday's note is there", () async {
        await spec.eventually(find.text(yesterdaysNote));
        expect(find.text('1 August 2026'), findsOneWidget);
      });

      await spec.when('the journal is turned forward again', () async {
        await spec.tap(find.byKey(JournalHomeKeys.nextDay));
      });

      await spec.then('today is blank once more', () async {
        await spec.eventually(find.byKey(JournalHomeKeys.emptyState));
        expect(find.text('2 August 2026'), findsOneWidget);
      });

      await spec.and('there is no way to walk into the future', () async {
        // Days that have not happened cannot hold anything, so offering them
        // would be an invitation to a dead end.
        expect(
          spec.tester
              .widget<IconButton>(find.byKey(JournalHomeKeys.nextDay))
              .onPressed,
          isNull,
        );
      });
    },
  );
}
