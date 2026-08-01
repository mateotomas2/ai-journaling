/// Where the app gets "now".
///
/// A seam, not ceremony: a journal is organised by day, so almost every
/// interesting behaviour — does this note belong to today, has the day rolled
/// over — depends on the date. Reading the system clock directly would make
/// those only testable by waiting until tomorrow.
typedef Clock = DateTime Function();

DateTime systemClock() => DateTime.now();
