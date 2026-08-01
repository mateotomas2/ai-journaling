import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/core/day_id.dart';

void main() {
  group('dayIdOf', () {
    test('pads month and day to two digits', () {
      expect(dayIdOf(DateTime(2026, 8, 1)), '2026-08-01');
    });

    test('leaves already-two-digit components alone', () {
      expect(dayIdOf(DateTime(2026, 12, 25)), '2026-12-25');
    });

    test('ignores the time component', () {
      expect(dayIdOf(DateTime(2026, 8, 1, 23, 59)), '2026-08-01');
    });
  });

  test('formatDayLabel renders a human-readable date', () {
    expect(formatDayLabel(DateTime(2026, 8, 1)), '1 August 2026');
  });

  test('formatTimeLabel pads to HH:mm', () {
    expect(formatTimeLabel(DateTime(2026, 8, 1, 9, 5)), '09:05');
  });
}
