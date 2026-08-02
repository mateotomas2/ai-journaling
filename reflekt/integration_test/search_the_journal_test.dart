import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';
import 'package:reflekt/features/journal/search_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';

import '_spec.dart';

/// SPEC — Search the journal
///
/// Stepping back a day at a time is fine for last week and useless for last
/// year. Once there is more than a few days of writing, finding something again
/// means searching for it.
///
/// A result is only useful if you can get back to where it came from, so
/// opening one takes you to that day rather than showing the note alone and
/// stranded.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * ranking, stemming or fuzzy matching — this is a plain substring match,
///     and pretending otherwise would set expectations the code does not meet
///   * searching by date, mood or category
///   * finding deleted notes, which ADR-0007 erases rather than hides
void main() {
  const password = 'a good password';
  const augustFirst = 'The sourdough finally worked.';
  const augustSecond = 'Rain all day, stayed in.';

  final firstDay = DateTime(2026, 8, 1, 9, 30);
  var now = firstDay;

  ReflektApp app(String storage) =>
      ReflektApp(storageDirectory: storage, clock: () => now);

  runSpec(
    'Search the journal',
    body: (spec) async {
      await spec.launch(app(spec.storageDirectory));

      Future<void> writeNote(String text) async {
        await spec.tap(find.byKey(JournalHomeKeys.addNote));
        await spec.type(find.byKey(NoteComposerKeys.field), text);
        await spec.tap(find.byKey(NoteComposerKeys.save));
        await spec.eventually(find.text(text));
      }

      await spec.given('notes written on two different days', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), password);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.addNote));

        await writeNote(augustFirst);
        now = firstDay.add(const Duration(days: 1));
        await writeNote(augustSecond);
      });

      await spec.when('the journal is searched for a word', () async {
        await spec.tap(find.byKey(JournalHomeKeys.search));
        await spec.eventually(find.byKey(SearchKeys.field));
        await spec.type(find.byKey(SearchKeys.field), 'sourdough');
      });

      await spec.then('only the note containing it is listed', () async {
        await spec.eventually(find.text(augustFirst));
        expect(find.text(augustSecond), findsNothing);
      });

      await spec.and('the result says which day it came from', () async {
        expect(find.text('1 August 2026'), findsOneWidget);
      });

      await spec.when('the result is opened', () async {
        await spec.tap(find.text(augustFirst));
      });

      await spec.then('the journal is showing that day', () async {
        await spec.eventually(find.byKey(JournalHomeKeys.noteList));
        expect(find.text('1 August 2026'), findsOneWidget);
        expect(find.text(augustFirst), findsOneWidget);
      });
    },
  );
}
