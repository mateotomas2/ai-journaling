import '../../db/journal_database.dart';
import 'journal_embedder.dart';

/// A note found by meaning, and how close it was.
class Match {
  const Match(this.note, this.closeness);
  final Note note;
  final double closeness;
}

/// Finds notes by what they meant rather than the words they used.
///
/// Ranks every embedded note against the query. That is fine for a journal —
/// a dot product over 384 floats, a few thousand times, is nothing — and an
/// approximate index would add a second thing to keep in step with the notes
/// for no benefit at this size.
class MeaningSearch {
  const MeaningSearch(this._database, this._embedder);

  final JournalDatabase _database;
  final JournalEmbedder _embedder;

  /// Below this, results stop resembling the question. Without a floor, an
  /// empty-handed search still returns its least-bad guesses ranked
  /// confidently, which reads as an answer and is not one.
  ///
  /// Measured rather than guessed. With this model, "exercise" against a note
  /// about going for a run scores **0.21**, and against an unrelated note about
  /// baking, **0.07**. An earlier floor of 0.25 was set by intuition and threw
  /// away the genuine match — these numbers are lower than they look, because
  /// MiniLM spreads sentence similarity over a narrow band.
  ///
  /// Re-measure with `tool/generate_reference_vectors.py` before changing it.
  static const _floor = 0.15;

  Future<List<Match>> search(String query, {int limit = 20}) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return const [];

    final target = await _embedder.embed(trimmed);
    final candidates = await _database.notesWithEmbeddings();

    final matches = <Match>[];
    for (final (note, bytes) in candidates) {
      final closeness = JournalEmbedder.similarity(
        target,
        JournalEmbedder.fromBytes(bytes),
      );
      if (closeness >= _floor) matches.add(Match(note, closeness));
    }

    matches.sort((a, b) => b.closeness.compareTo(a.closeness));
    return matches.take(limit).toList();
  }
}
