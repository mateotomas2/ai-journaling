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
  Future<Answer> ask({
    required String question,
    required List<String> entries,
    List<Exchange> earlier = const [],
  });
}

/// What the assistant decided to do with a question.
///
/// A note is written only when someone asks for one. An assistant that records
/// things unprompted is a different and less trustworthy product: a journal has
/// to be somewhere you can think out loud without it being minuted.
class Answer {
  const Answer(this.reply, {this.noteToWrite});

  /// What to show the person.
  final String reply;

  /// Text to save as a note, when they asked for that. Null otherwise.
  final String? noteToWrite;
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
