// This is a CLI driver; printing the step trace IS the interface.
// ignore_for_file: avoid_print

import 'dart:convert';
import 'dart:io';

import 'package:integration_test/integration_test_driver_extended.dart';

/// Driver for the evidence run. See CLAUDE.md > Evidence system.
///
/// Two non-default settings matter here:
///
/// * `onScreenshot` writes every frame the test requests to `evidence/frames/`.
///   These come from WebDriver (i.e. Chrome's own renderer), not from a screen
///   grab, so recording does not depend on the compositor — which is what makes
///   it work under Wayland and in headless CI.
/// * `writeResponseOnFailure` defaults to `false`, meaning diagnostics are
///   dropped on exactly the runs you need them for. Web profile builds strip
///   `debugPrint` and report empty assertion details, so without this a failed
///   evidence run tells you nothing.
Future<void> main() async {
  final frameDir = Directory('evidence/frames');
  if (frameDir.existsSync()) {
    frameDir.deleteSync(recursive: true);
  }
  frameDir.createSync(recursive: true);

  await integrationDriver(
    writeResponseOnFailure: true,
    responseDataCallback: (data) async {
      if (data == null) return;
      print('REPORT_DATA ${jsonEncode(data)}');
    },
    onScreenshot: (name, bytes, [args]) async {
      File('${frameDir.path}/$name.png').writeAsBytesSync(bytes);
      return true;
    },
  );
}
