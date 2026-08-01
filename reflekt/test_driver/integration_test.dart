// This is a CLI driver; printing the step trace IS the interface.
// ignore_for_file: avoid_print

import 'dart:convert';

import 'package:integration_test/integration_test_driver.dart';

/// Driver for the evidence run. See CLAUDE.md > Evidence system.
///
/// The video is captured by `adb shell screenrecord` alongside this, so the
/// driver's only job is to surface the spec's step trace.
///
/// `writeResponseOnFailure` defaults to `false`, which drops the trace on
/// exactly the runs that need it. With it on, a failed spec reports `failedAt`
/// — the clause that stopped holding — instead of a bare stack.
Future<void> main() => integrationDriver(
      writeResponseOnFailure: true,
      responseDataCallback: (data) async {
        if (data == null) return;
        print('REPORT_DATA ${jsonEncode(data)}');
      },
    );
