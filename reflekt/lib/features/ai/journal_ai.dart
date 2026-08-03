/// What the app needs from an AI, and nothing more.
///
/// An interface rather than a client so specs can run offline against a fixed
/// responder. A spec that called OpenRouter would be slow, would cost money on
/// every run, and would fail for reasons that have nothing to do with the code
/// — and its recording would prove the network worked, not that the app did.
abstract interface class JournalAi {
  /// Answers [question] using [entries] as the only source.
  ///
  /// [earlier] is the exchange so far, oldest first, so a follow-up can lean on
  /// what was already said. Empty for the first question.
  Future<String> ask({
    required String question,
    required List<String> entries,
    List<Exchange> earlier = const [],
  });
}

/// One question and its answer.
class Exchange {
  const Exchange(this.question, this.answer);
  final String question;
  final String answer;
}

/// Raised when the journal cannot reach or use the AI. Carries a sentence fit
/// to show someone, because "Exception: 401" is not an answer.
class JournalAiException implements Exception {
  const JournalAiException(this.message);
  final String message;
  @override
  String toString() => message;
}
