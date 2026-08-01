/// Harness that lets an integration test read as the feature's specification.
///
/// The spec IS the test — there is no separate spec document to keep in sync.
/// Everything mechanical (frame capture for the evidence video, the step trace
/// used to debug failures) lives here so a test body contains only the
/// behaviour being specified.
///
/// Not named `*_test.dart`, so it is never collected as a flow.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

/// Declares a feature's specification.
///
/// [title] names the feature in plain language — it is the spec's title and
/// shows up in the failure report.
Future<void> runSpec(
  String title, {
  required Future<void> Function(Spec spec) body,
}) async {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(title, (tester) async {
    final spec = Spec._(tester, binding);
    try {
      await body(spec);
      binding.reportData = {'spec': title, 'steps': spec.steps};
    } catch (e, st) {
      // Web profile builds strip debugPrint and report empty assertion
      // details, so this trace is the only usable debugging channel. It shows
      // which step was reached. Paired with `writeResponseOnFailure: true` in
      // the driver, which is off by default.
      binding.reportData = {
        'spec': title,
        'steps': spec.steps,
        'failedAt': spec.steps.isEmpty ? '(before first step)' : spec.steps.last,
        'error': e.toString(),
        'stack': st.toString().split('\n').take(6).join(' | '),
      };
      rethrow;
    }
  });
}

/// The vocabulary a spec is written in.
class Spec {
  Spec._(this.tester, this._binding);

  /// Escape hatch for assertions that need widget internals, e.g.
  /// `spec.tester.widget<TextButton>(finder).onPressed`.
  final WidgetTester tester;
  final IntegrationTestWidgetsFlutterBinding _binding;

  final _steps = <String>[];
  int _frame = 0;

  /// The behaviours asserted so far, in order. Reported back to the driver.
  List<String> get steps => List.unmodifiable(_steps);

  /// The state the world is in before anything happens.
  ///
  /// Sets up and/or asserts starting conditions. A spec normally opens with
  /// exactly one `given`.
  Future<void> given(String description, Future<void> Function() body) =>
      _step('Given', description, body);

  /// The action being specified. **Acts, never asserts** — put the expectations
  /// in the following [then], or the spec stops saying which behaviour is
  /// actually under test.
  Future<void> when(String description, Future<void> Function() body) =>
      _step('When', description, body);

  /// The outcome that must hold. **Asserts, never acts.**
  Future<void> then(String description, Future<void> Function() body) =>
      _step('Then', description, body);

  /// Continues the preceding keyword, so a clause reads as prose rather than
  /// repeating `Then … Then …`.
  Future<void> and(String description, Future<void> Function() body) =>
      _step('And', description, body);

  /// [description] completes its keyword as a sentence — it is a line of the
  /// specification, so write it for a human, not a machine. Frames are captured
  /// at the end so the recording lingers long enough to read.
  Future<void> _step(
    String keyword,
    String description,
    Future<void> Function() body,
  ) async {
    _steps.add('$keyword $description');
    await body();
    await _hold();
  }

  /// Starts the app. Call once, before the first step.
  Future<void> launch(Widget app) async {
    await tester.pumpWidget(app);
    await _hold();
  }

  Future<void> tap(Finder finder) async {
    await tester.tap(finder);
    await _hold(2);
  }

  /// Types [text] one character at a time.
  ///
  /// Deliberately not `tester.enterText`: on Flutter web the engine routes
  /// text through a hidden DOM input the test harness never reaches, so
  /// `enterText` silently leaves the controller empty and the failure message
  /// is useless. Driving `EditableTextState.updateEditingValue` is the same
  /// path the real platform uses to deliver keystrokes.
  Future<void> type(Finder finder, String text) async {
    await tester.tap(finder);
    await _hold(2);

    final editable = tester.state<EditableTextState>(
      find.descendant(of: finder, matching: find.byType(EditableText)),
    );

    for (var i = 1; i <= text.length; i++) {
      editable.updateEditingValue(
        TextEditingValue(
          text: text.substring(0, i),
          selection: TextSelection.collapsed(offset: i),
        ),
      );
      if (i % 3 == 0 || i == text.length) {
        await _shoot();
      } else {
        await tester.pump(const Duration(milliseconds: 16));
      }
    }
  }

  /// Captures one frame of the evidence recording.
  ///
  /// Frames come from WebDriver rather than a screen grab, which is what makes
  /// recording independent of the compositor and workable headless in CI.
  Future<void> _shoot() async {
    for (var i = 0; i < 3; i++) {
      await tester.pump(const Duration(milliseconds: 16));
    }
    await _binding.takeScreenshot('f${_frame.toString().padLeft(4, '0')}');
    _frame++;
  }

  /// Holds the current screen for [shots] frames so a reviewer can read it.
  ///
  /// Never uses `pumpAndSettle`: once a text field has focus its cursor blinks
  /// forever, so the tree never settles and `pumpAndSettle` times out.
  Future<void> _hold([int shots = 4]) async {
    for (var i = 0; i < shots; i++) {
      await _shoot();
    }
  }
}
