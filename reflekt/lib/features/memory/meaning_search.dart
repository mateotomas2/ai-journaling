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

  /// Higher than the search floor, because the two want opposite things.
  ///
  /// Search favours recall: showing a weak match costs a line on screen, and
  /// the person reading decides. Context favours precision: every entry sent
  /// leaves the device, and an entry that only vaguely relates gives the model
  /// something to be confused by while adding to what was exposed.
  ///
  /// Measured for "How did exercise feel?": a note about going for a run
  /// scores **0.44**; one about a tax return scores **0.21** — related only in
  /// that both mention how something felt — and one about baking, **0.10**.
  /// A floor of 0.15 let the tax return through.
  static const _contextFloor = 0.3;

  /// The entries closest to [question], for answering it.
  ///
  /// Sending the whole journal to a third party to answer one question is
  /// wrong twice over: it costs more the longer someone has kept a journal,
  /// and it exposes years of writing to answer something about a week of it.
  ///
  /// Unrelated entries are dropped rather than padded in. It is tempting to
  /// send a few extra "just in case", but every entry sent is one more thing
  /// leaving the device, and an entry the question has nothing to do with
  /// cannot help answer it.
  ///
  /// If nothing clears the floor, the closest few go anyway — a thin answer
  /// beats refusing to answer, and by then the cost is a handful of entries
  /// rather than the whole journal.
  Future<List<String>> contextFor(String question, {int limit = 12}) async {
    final target = await _embedder.embed(question);
    final candidates = await _database.notesWithEmbeddings();

    final ranked = [
      for (final (note, bytes) in candidates)
        Match(
          note,
          JournalEmbedder.similarity(target, JournalEmbedder.fromBytes(bytes)),
        ),
    ]..sort((a, b) => b.closeness.compareTo(a.closeness));

    final related = ranked.where((m) => m.closeness >= _contextFloor).toList();
    final chosen = related.isNotEmpty ? related : ranked.take(3).toList();
    return chosen.take(limit).map((m) => m.note.content).toList();
  }

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
