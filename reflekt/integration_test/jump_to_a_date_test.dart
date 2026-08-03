import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';
import 'package:reflekt/features/lock/unlock_page.dart';

import '_spec.dart';

/// SPEC — Jump to a date
///
/// Turning back a page at a time is right for the recent past and hopeless for
/// anything older: nobody swipes to last March. The date at the top of the day
/// is a control, and touching it asks which day you meant.
///
/// It carries a second job. Swiping between days is invisible until someone
/// tries it, so the header being visibly touchable is what tells them the days
/// are a thing you move through.
///
/// The clock is injected so the day can roll over on demand. Waiting until next
/// week is not a test strategy.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * stepping day by day, which `read_earlier_days_test.dart` covers
///   * choosing a day in the future — a day that has not happened cannot hold
///     anything, so the picker does not offer one
///   * writing onto the day you land on; notes are written on the day you write
///     them
void main() {
  const password = 'a good password';
  const oldNote = 'The first day of the month.';

  final firstDay = DateTime(2026, 8, 1, 9, 30);
  var now = firstDay;

  runSpec(
    'Jump to a date',
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
        await spec.type(find.byKey(NoteComposerKeys.field), oldNote);
        await spec.tap(find.byKey(NoteComposerKeys.save));
        await spec.eventually(find.text(oldNote));
      });

      await spec.and('a fortnight having passed since', () async {
        now = firstDay.add(const Duration(days: 14));
        await spec.restart(
          ReflektApp(
            storageDirectory: spec.storageDirectory,
            clock: () => now,
          ),
        );
        await spec.type(find.byKey(UnlockKeys.field), password);
        await spec.tap(find.byKey(UnlockKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.emptyState));
        expect(find.text('15 August 2026'), findsOneWidget);
      });

      await spec.when('the date is touched', () async {
        await spec.tap(find.byKey(JournalHomeKeys.dayHeader));
      });

      await spec.then('the journal asks which day was meant', () async {
        await spec.eventually(find.text('OK'));
      });

      await spec.when('the 1st is chosen', () async {
        await spec.tap(find.text('1'));
        await spec.tap(find.text('OK'));
      });

      await spec.then('that day is open, with its note on it', () async {
        await spec.eventually(find.text(oldNote));
        expect(find.text('1 August 2026'), findsOneWidget);
      });
    },
  );
}
