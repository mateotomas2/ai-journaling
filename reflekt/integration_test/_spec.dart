/// Harness that lets an integration test read as the feature's specification.
///
/// The spec IS the test — there is no separate spec document to keep in sync.
/// Everything mechanical (frame capture for the evidence video, the step trace
/// used to debug failures) lives here so a test body contains only the
/// behaviour being specified.
///
/// Not named `*_test.dart`, so it is never collected as a flow.
library;

import 'dart:async';
import 'dart:io';

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
    // A fresh directory per run. The app's real storage survives between runs
    // on a device, so without this the second run would find the previous
    // journal and open a lock screen where the spec expects a first run.
    final storage = Directory.systemTemp.createTempSync('reflekt-spec');
    final spec = Spec._(tester, storage.path);
    try {
      await body(spec);
      // Rest on the final screen. `flutter drive` exits the moment the body
      // returns and the recording stops with it, so without this the video can
      // end mid-transition — on a spinner rather than on the outcome the spec
      // exists to demonstrate.
      await spec._hold(2000);
      binding.reportData = {
        'spec': title,
        'steps': spec.steps,
        'waits': spec.waits,
      };
    } catch (e, st) {
      // Reported back through the driver, which needs
      // `writeResponseOnFailure: true` — off by default, so without it these
      // diagnostics are dropped on exactly the runs that need them. `failedAt`
      // names the clause of the spec that stopped holding.
      binding.reportData = {
        'spec': title,
        'steps': spec.steps,
        'waits': spec.waits,
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
  Spec._(this.tester, this.storageDirectory);

  /// Escape hatch for assertions that need widget internals, e.g.
  /// `spec.tester.widget<TextButton>(finder).onPressed`.
  final WidgetTester tester;

  /// A directory unique to this run. Pass it to `ReflektApp` so the spec starts
  /// from an empty device every time.
  final String storageDirectory;

  final _steps = <String>[];

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

  /// Relaunches the app, discarding everything held in memory.
  ///
  /// Pumps an unrelated widget in between, and this is load-bearing: pumping
  /// the same widget type again would *update* the existing element tree and
  /// reuse its `State` objects, so in-memory state would survive and a
  /// persistence spec would pass without anything being persisted. Clearing the
  /// tree first forces fresh `State`.
  ///
  /// This is not a process restart — the isolate, and anything cached at module
  /// scope, are untouched. It proves state was rebuilt from storage rather than
  /// held in a widget.
  Future<void> restart(Widget app) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
    await tester.pumpWidget(app);
    await _hold();
  }

  Future<void> tap(Finder finder) async {
    await tester.tap(finder);
    // Long enough to cover a route transition on an emulator, which is a good
    // deal slower than a desktop browser.
    await _hold(700);
  }

  /// Types [text] one character at a time, so the recording shows it being
  /// written rather than appearing in a single frame.
  ///
  /// Deliberately not `tester.enterText`, which would fill the field instantly.
  /// `EditableTextState.updateEditingValue` is the same path the platform uses
  /// to deliver keystrokes, so this stays faithful while remaining watchable.
  Future<void> type(Finder finder, String text, {bool clear = false}) async {
    await tester.tap(finder);
    await _hold(300);

    final editable = tester.state<EditableTextState>(
      find.descendant(of: finder, matching: find.byType(EditableText)),
    );

    if (clear) {
      editable.updateEditingValue(TextEditingValue.empty);
      await _hold(200);
    }

    for (var i = 1; i <= text.length; i++) {
      editable.updateEditingValue(
        TextEditingValue(
          text: text.substring(0, i),
          selection: TextSelection.collapsed(offset: i),
        ),
      );
      // Slow enough that the recording shows text being typed, not appearing.
      await _hold(45);
    }
  }

  /// Drags [finder] sideways, as turning a page does.
  ///
  /// Deliberately a real drag with a fling velocity rather than jumping a
  /// `PageController`: driving the controller would prove the pager can be told
  /// to move, not that the gesture works — and the recording would show a day
  /// change with nothing having touched the screen.
  Future<void> swipeRight(Finder finder) => _swipe(finder, 320);

  /// The opposite gesture. Moves forward in time, so it does nothing on today.
  Future<void> swipeLeft(Finder finder) => _swipe(finder, -320);

  Future<void> _swipe(Finder finder, double dx) async {
    await tester.fling(finder, Offset(dx, 0), 600);
    await _hold(700);
  }

  /// Scrolls until [finder] is on screen.
  ///
  /// A list only builds what is visible, so something below the fold is not
  /// merely unseen — it is not in the widget tree at all. Where the screen
  /// genuinely scrolls, reaching for something is what a person does, and the
  /// spec should do the same rather than assert against a hidden widget.
  /// [scrollable] defaults to the outermost one on the page. It has to be said
  /// explicitly: a multiline `TextField` carries its own scrollable, so a page
  /// containing one has several, and `scrollUntilVisible` refuses to guess.
  Future<void> scrollTo(Finder finder, {Finder? scrollable}) async {
    await tester.scrollUntilVisible(
      finder,
      120,
      scrollable: scrollable ?? find.byType(Scrollable).first,
      duration: const Duration(milliseconds: 80),
    );
    await _hold(400);
  }

  /// Sends the app to the background, as switching apps would.
  Future<void> sendToBackground() async {
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await _hold(300);
  }

  /// Brings the app back to the foreground.
  Future<void> bringToForeground() async {
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await _hold(600);
  }

  /// Lets real time pass while keeping the recording moving.
  Future<void> waitFor(Duration duration) => _hold(duration.inMilliseconds);

  /// Pumps until [finder] matches something, or gives up.
  ///
  /// For outcomes that arrive on their own schedule — deriving a key is
  /// deliberately slow, and slower still on an emulator. A fixed pause would
  /// either flake or pad every recording with dead time.
  Future<void> eventually(
    Finder finder, {
    Duration timeout = const Duration(seconds: 120),
  }) async {
    final started = DateTime.now();
    while (DateTime.now().difference(started) < timeout) {
      await tester.pump(const Duration(milliseconds: 50));
      if (finder.evaluate().isNotEmpty) {
        _waits.add(' after '
            '${DateTime.now().difference(started).inMilliseconds}ms');
        return;
      }
    }
    throw TimeoutException(
      'Waited ${timeout.inSeconds}s for  and it never '
      'appeared.',
    );
  }

  /// How long each `eventually` actually took. Reported back with the trace so
  /// a slow spec explains itself instead of just feeling sluggish.
  final _waits = <String>[];
  List<String> get waits => List.unmodifiable(_waits);

  /// Pumps frames for [ms] of wall-clock time.
  ///
  /// The evidence video is captured off-device by `adb shell screenrecord`
  /// while this runs, so the spec's only job is to move at a pace a human can
  /// follow. Without these pauses the whole flow completes in a few frames and
  /// the recording is useless as evidence.
  ///
  /// Never uses `pumpAndSettle`: once a text field has focus its cursor blinks
  /// forever, so the tree never settles and `pumpAndSettle` times out.
  Future<void> _hold([int ms = 900]) async {
    final deadline = DateTime.now().add(Duration(milliseconds: ms));
    while (DateTime.now().isBefore(deadline)) {
      await tester.pump(const Duration(milliseconds: 16));
    }
  }
}
