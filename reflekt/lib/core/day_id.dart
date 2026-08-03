const _monthNames = <String>[
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/// A `dayId` is the `YYYY-MM-DD` key that groups everything written on one
/// calendar day. Matches the format used by the PWA (`src/types/entities.ts`).
String dayIdOf(DateTime date) {
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '${date.year}-$month-$day';
}

/// Human-readable rendering of a day, e.g. `1 August 2026`.
String formatDayLabel(DateTime date) =>
    '${date.day} ${_monthNames[date.month - 1]} ${date.year}';

const _weekdayNames = <String>[
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/// The day of the week, e.g. `Saturday`. Sits under the date so a page of the
/// journal reads as a day someone lived rather than as a database key.
String formatWeekdayLabel(DateTime date) => _weekdayNames[date.weekday - 1];

/// Clock time of a note, e.g. `09:41`.
String formatTimeLabel(DateTime date) {
  final hour = date.hour.toString().padLeft(2, '0');
  final minute = date.minute.toString().padLeft(2, '0');
  return '$hour:$minute';
}

/// Reads a `dayId` back into a date. The inverse of [dayIdOf].
DateTime parseDayId(String dayId) {
  final parts = dayId.split('-').map(int.parse).toList();
  return DateTime(parts[0], parts[1], parts[2]);
}
