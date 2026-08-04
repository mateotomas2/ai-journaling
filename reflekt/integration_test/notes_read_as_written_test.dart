import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';

import '_spec.dart';

/// SPEC — A note reads as it was written
///
/// The assistant writes markdown whether or not anyone asked it to — lists,
/// emphasis, the occasional heading. Rendered literally, that puts asterisks
/// and hashes into someone's journal, which is the machine's syntax leaking
/// into their writing.
///
/// Someone typing plain prose sees no difference, and that is the point:
/// nothing here asks them to know what markdown is. The composer stays a plain
/// field — writing a note is one action, and a preview toggle would make it
/// two.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * a title on a note; the composer is one field on purpose
///   * editing with a preview, or any markdown toolbar
///   * tables, images and anything else a journal entry has no use for
void main() {
  const password = 'a good password';
  const written = 'Three good things today:\n\n'
      '- **slept** properly\n'
      '- walked at lunch\n'
      '- finished the *bread*';

  runSpec(
    'A note reads as it was written',
    body: (spec) async {
      await spec.launch(ReflektApp(storageDirectory: spec.storageDirectory));

      await spec.given('a new journal', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), password);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.addNote));
      });

      await spec.when('something is written with a list in it', () async {
        await spec.tap(find.byKey(JournalHomeKeys.addNote));
        await spec.type(find.byKey(NoteComposerKeys.field), written);
        await spec.tap(find.byKey(NoteComposerKeys.save));
      });

      await spec.then('the words are all there', () async {
        await spec.eventually(find.textContaining('slept'));
        expect(find.textContaining('finished the'), findsWidgets);
      });

      await spec.and('the markers are not', () async {
        // The whole point. Asterisks on screen are the syntax showing
        // through, and nobody wrote them meaning to see them.
        expect(find.textContaining('**'), findsNothing);
        expect(find.textContaining('- walked'), findsNothing);
      });

      await spec.and('it is still an ordinary note to edit', () async {
        // Rendered for reading, plain for writing: the composer shows what was
        // actually typed, markers and all, because that is what editing it
        // means.
        await spec.tap(find.textContaining('slept'));
        await spec.eventually(find.byKey(NoteComposerKeys.field));
        expect(find.textContaining('**slept**'), findsOneWidget);
      });
    },
  );
}
