import '../../db/journal_database.dart';
import 'journal_embedder.dart';

/// Indexes anything written that has no vector yet.
///
/// Needed because the index arrived after the notes did: anything written
/// before this feature existed is invisible to meaning search until it is
/// embedded, and a journal that silently cannot find its own older entries is
/// worse than one with no such search at all.
///
/// Also repairs gaps left by embedding failures, which are swallowed at write
/// time so that losing an index entry never costs someone their note.
class IndexBackfill {
  const IndexBackfill(this._database, this._embedder);

  final JournalDatabase _database;
  final JournalEmbedder _embedder;

  /// Embeds everything still missing, reporting how many were done.
  ///
  /// [onProgress] receives (done, total). Runs one note at a time on purpose:
  /// a journal being caught up in the background should not make the phone
  /// unusable, and there is no deadline.
  Future<int> run({void Function(int done, int total)? onProgress}) async {
    // Notes and the person's own messages alike. An assistant's reply is never
    // in here: it restates what it was given, so indexing it would rank the
    // machine paraphrasing you above the thing you actually wrote (ADR-0010).
    final pending = <(IndexedKind, String, String)>[
      for (final note in await _database.notesWithoutEmbeddings())
        (IndexedKind.note, note.id, note.content),
      for (final message in await _database.messagesWithoutEmbeddings())
        (IndexedKind.message, message.id, message.content),
    ];
    if (pending.isEmpty) return 0;

    var done = 0;
    for (final (kind, id, content) in pending) {
      try {
        final vector = await _embedder.embed(content);
        await _database.putEmbeddingFor(
          kind,
          id,
          JournalEmbedder.toBytes(vector),
        );
      } catch (_) {
        // One entry failing must not abandon the rest — a single unindexable
        // entry should cost that entry, not the whole journal.
      }
      done++;
      onProgress?.call(done, pending.length);
    }
    return done;
  }
}
