import 'package:flutter/material.dart';

import '../../core/day_id.dart';
import '../../db/journal_database.dart';

/// Keys the specs drive. Keep these stable — renaming one breaks a recording.
class WhichDayKeys {
  static const sheet = Key('which_day_sheet');
  static const days = Key('which_day_days');
  static const pickADate = Key('which_day_pick_a_date');
  static const nothingYet = Key('which_day_nothing_yet');

  static Key dayOf(String dayId) => Key('which_day_$dayId');
}

/// Which day to open.
///
/// Reached by touching the date, which is also what tells someone the days are
/// something you move through — the swipe is invisible until you try it.
///
/// Both ways of getting somewhere live here rather than behind separate
/// controls: the days you have written on, for the recent past you can
/// recognise, and a calendar for the date you can name. A third icon in the
/// header would have bought the same thing at the cost of the header.
Future<DateTime?> chooseDay({
  required BuildContext context,
  required JournalDatabase database,
  required DateTime today,
}) =>
    showModalBottomSheet<DateTime>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => _WhichDay(database: database, today: today),
    );

class _WhichDay extends StatefulWidget {
  const _WhichDay({required this.database, required this.today});

  final JournalDatabase database;
  final DateTime today;

  @override
  State<_WhichDay> createState() => _WhichDayState();
}

class _WhichDayState extends State<_WhichDay> {
  List<(String, int)>? _days;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final days = await widget.database.daysWithSomething();
    if (mounted) setState(() => _days = days);
  }

  Future<void> _pickADate() async {
    final chosen = await showDatePicker(
      context: context,
      initialDate: widget.today,
      firstDate: DateTime(2020),
      lastDate: widget.today,
    );
    if (chosen != null && mounted) Navigator.of(context).pop(chosen);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final days = _days;

    return SafeArea(
      key: WhichDayKeys.sheet,
      child: SizedBox(
        // Half the screen: enough to show the shape of the journal, not so
        // much that it becomes a second home screen.
        height: MediaQuery.sizeOf(context).height * 0.55,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Days you have written on',
                      style: theme.textTheme.titleMedium),
                  TextButton.icon(
                    key: WhichDayKeys.pickADate,
                    onPressed: _pickADate,
                    icon: const Icon(Icons.calendar_today_outlined, size: 18),
                    label: const Text('Pick a date'),
                  ),
                ],
              ),
            ),
            Expanded(
              child: switch (days) {
                null => const Center(child: CircularProgressIndicator()),
                [] => Center(
                    key: WhichDayKeys.nothingYet,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 48),
                      child: Text(
                        'Nothing written yet. Today is as good a place to '
                        'start as any.',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodyLarge?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ),
                _ => ListView.separated(
                    key: WhichDayKeys.days,
                    itemCount: days.length,
                    separatorBuilder: (_, _) =>
                        const Divider(indent: 20, endIndent: 20),
                    itemBuilder: (context, index) {
                      final (dayId, held) = days[index];
                      final day = parseDayId(dayId);

                      return InkWell(
                        key: WhichDayKeys.dayOf(dayId),
                        onTap: () => Navigator.of(context).pop(day),
                        child: Padding(
                          padding:
                              const EdgeInsets.fromLTRB(20, 14, 20, 14),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(formatDayLabel(day),
                                      style: theme.textTheme.titleLarge),
                                  Text(formatWeekdayLabel(day),
                                      style: theme.textTheme.labelSmall),
                                ],
                              ),
                              // How much is on a day, so the list shows the
                              // shape of the journal rather than only its
                              // dates.
                              Text(
                                '$held',
                                style: theme.textTheme.labelSmall,
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
              },
            ),
          ],
        ),
      ),
    );
  }
}
