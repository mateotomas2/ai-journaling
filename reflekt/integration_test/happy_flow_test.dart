import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';

/// Captures the frames that become the evidence MP4.
///
/// Frames come from WebDriver (Chrome's own renderer) rather than a screen
/// grab, so the recording is independent of the compositor. `scripts/
/// record_evidence.sh` stitches whatever lands in `evidence/frames/`.
class Reel {
  Reel(this.tester, this.binding);

  final WidgetTester tester;
  final IntegrationTestWidgetsFlutterBinding binding;
  int _frame = 0;

  /// Pumps a few frames, then captures one. Each capture is a WebDriver round
  /// trip, so the count — not wall-clock time — controls how long the finished
  /// video runs.
  Future<void> shoot() async {
    for (var i = 0; i < 3; i++) {
      await tester.pump(const Duration(milliseconds: 16));
    }
    await binding.takeScreenshot('f${_frame.toString().padLeft(4, '0')}');
    _frame++;
  }

  /// Holds the current screen for [shots] frames, so a reviewer can actually
  /// read it before the flow moves on.
  Future<void> hold([int shots = 4]) async {
    for (var i = 0; i < shots; i++) {
      await shoot();
    }
  }
}

/// Types [text] into the field found by [finder], capturing as it goes.
///
/// Does NOT use `tester.enterText`: on Flutter web the engine routes text
/// through a hidden DOM input that the test text-input harness never reaches,
/// so `enterText` silently leaves the controller empty and the test fails with
/// no usable message. Driving `EditableTextState.updateEditingValue` is the
/// same code path the real platform uses to deliver keystrokes.
Future<void> typeInto(
  Reel reel,
  Finder finder,
  String text, {
  int charsPerFrame = 3,
}) async {
  await reel.tester.tap(finder);
  await reel.hold(2);

  final editable = reel.tester.state<EditableTextState>(
    find.descendant(of: finder, matching: find.byType(EditableText)),
  );

  for (var i = 1; i <= text.length; i++) {
    editable.updateEditingValue(
      TextEditingValue(
        text: text.substring(0, i),
        selection: TextSelection.collapsed(offset: i),
      ),
    );
    if (i % charsPerFrame == 0 || i == text.length) {
      await reel.shoot();
    } else {
      await reel.tester.pump(const Duration(milliseconds: 16));
    }
  }
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('happy flow: write a note and see it on today\'s journal',
      (tester) async {
    final reel = Reel(tester, binding);

    // Web profile builds strip debugPrint and report empty assertion details,
    // so the step trace is handed back through `reportData` instead. Paired
    // with `writeResponseOnFailure: true` in the driver, this is what makes a
    // failed evidence run debuggable.
    final trace = <String>[];
    void step(String name) => trace.add(name);

    try {
      step('boot');
      await tester.pumpWidget(const ReflektApp());
      await reel.hold(3);

      // 1. Land on today's journal, nothing written yet.
      step('home-visible');
      expect(find.byKey(JournalHomeKeys.emptyState), findsOneWidget);
      expect(find.text('Reflekt'), findsOneWidget);
      await reel.hold(4);

      // 2. Open the composer.
      step('open-composer');
      await tester.tap(find.byKey(JournalHomeKeys.addNote));
      await reel.hold(4);
      expect(find.byKey(NoteComposerKeys.field), findsOneWidget);

      // 3. Saving is blocked until there is actually something to save.
      step('save-disabled');
      expect(
        tester.widget<TextButton>(find.byKey(NoteComposerKeys.save)).onPressed,
        isNull,
      );

      // 4. Write a note.
      step('type');
      const noteText = 'Shipped the Flutter foundation today.';
      await typeInto(reel, find.byKey(NoteComposerKeys.field), noteText);
      await reel.hold(3);

      step('text-landed:${tester.widget<TextField>(
        find.byKey(NoteComposerKeys.field),
      ).controller?.text}');

      step('save-enabled');
      expect(
        tester.widget<TextButton>(find.byKey(NoteComposerKeys.save)).onPressed,
        isNotNull,
      );

      // 5. Save it.
      step('tap-save');
      await tester.tap(find.byKey(NoteComposerKeys.save));
      await reel.hold(4);

      // 6. Back on the journal, the note is listed and the empty state is gone.
      step('verify-list');
      expect(find.byKey(JournalHomeKeys.emptyState), findsNothing);
      expect(find.byKey(JournalHomeKeys.noteList), findsOneWidget);
      expect(find.text(noteText), findsOneWidget);
      await reel.hold(6);

      step('done');
      binding.reportData = {'trace': trace, 'frames': reel._frame};
    } catch (e, st) {
      binding.reportData = {
        'trace': trace,
        'frames': reel._frame,
        'error': e.toString(),
        'stack': st.toString().split('\n').take(6).join(' | '),
      };
      rethrow;
    }
  });
}
