/// What a note is about.
///
/// A small fixed set, taken from the categories the PWA settled on. Open-ended
/// tags would let a journal grow a vocabulary nobody can remember, and the
/// point is to be able to scan a day, not to file it.
///
/// Uncategorised is deliberately allowed: making someone classify a thought
/// before writing it down is a good way to stop them writing it down.
enum NoteCategory {
  personal('personal', 'Personal'),
  health('health', 'Health'),
  dream('dream', 'Dream'),
  insight('insight', 'Insight');

  const NoteCategory(this.id, this.label);

  /// Stored value. Kept stable — it is written into the database.
  final String id;

  /// How it is shown.
  final String label;

  static NoteCategory? fromId(String? id) {
    if (id == null || id.isEmpty) return null;
    for (final category in values) {
      if (category.id == id) return category;
    }
    // An unknown category means data written by a newer version. Showing the
    // note uncategorised is better than hiding it.
    return null;
  }
}
