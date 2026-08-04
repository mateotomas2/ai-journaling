/// What a note is about.
///
/// Free text, not a fixed set (ADR-0012). The four the app used to insist on
/// were chosen by us for someone else's life, and had nothing for work, for
/// the people they live with, or for whatever they are actually preoccupied
/// with this year.
///
/// Uncategorised is still first-class: making someone classify a thought
/// before writing it down is a good way to stop them writing it down.
class NoteCategories {
  const NoteCategories._();

  /// Offered to a journal that has not named anything yet, so the first note
  /// is not faced with a blank field. They carry no special status — the
  /// moment someone writes their own, these are just the ones nobody used.
  static const suggestions = ['personal', 'health', 'dream', 'insight'];

  /// How a category reads on screen. Stored lowercase and shown capitalised,
  /// so "Work" and "work" are the same category rather than two.
  static String label(String category) => category.isEmpty
      ? ''
      : category[0].toUpperCase() + category.substring(1);

  /// What gets stored. Trimmed and lowercased, because a category that
  /// differs from another only by a capital letter is a filter that quietly
  /// splits a day in two.
  static String store(String typed) => typed.trim().toLowerCase();
}
