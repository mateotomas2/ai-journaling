import 'journal_tool.dart';

/// What the app needs from an AI, and nothing more.
///
/// An interface rather than a client so specs can run offline against a fixed
/// responder. A spec that called OpenRouter would be slow, would cost money on
/// every run, and would fail for reasons that have nothing to do with the code
/// — and its recording would prove the network worked, not that the app did.
abstract interface class JournalAi {
  /// Answers [question] using [entries] as the only source, as it is written.
  ///
  /// A stream rather than a future because an answer arrives over seconds, and
  /// a spinner for all of it says only that something is happening. Watching
  /// the words appear says *what* is happening, and lets someone start reading
  /// before it has finished.
  ///
  /// [earlier] is the exchange so far, oldest first, so a follow-up can lean on
  /// what was already said. Empty for the first question.
  ///
  /// A successful stream ends with exactly one [AiFinished]. A failed one ends
  /// with a [JournalAiException] and no [AiFinished] — a stream that simply
  /// stopped early must not close cleanly, or half an answer is
  /// indistinguishable from a short one.
  ///
  /// [tools] are what the assistant may do besides talk. Running them and
  /// feeding the results back is the client's job — a caller sees only that
  /// something was done, through [AiToolRan].
  Stream<AiEvent> ask({
    required String question,
    required List<String> entries,
    List<Exchange> earlier = const [],
    List<JournalTool> tools = const [],
  });
}

/// Something the assistant did, as it happened.
sealed class AiEvent {
  const AiEvent();
}

/// More of the answer. A [delta] is a fragment — providers split their stream
/// wherever they like, so it is not a word, a sentence, or anything else you
/// could reason about on its own.
class AiText extends AiEvent {
  const AiText(this.delta);
  final String delta;
}

/// The assistant did something to the journal, and has gone back to thinking.
///
/// Reported so a pause can say what is happening. Someone waiting deserves to
/// know their journal is being read rather than that the app has hung.
class AiToolRan extends AiEvent {
  const AiToolRan(this.tool);

  /// The tool's name, as the journal knows it.
  final String tool;
}

/// The answer, whole. Emitted once, at the end of a stream that succeeded.
class AiFinished extends AiEvent {
  const AiFinished(this.answer);
  final Answer answer;
}

/// What the assistant said.
///
/// Only words. Anything that reaches the journal does so through a tool the
/// journal chose to offer (ADR-0009) — text is never inspected for instructions,
/// because a reply that can quietly write to the journal is one a model can be
/// talked into misusing.
class Answer {
  const Answer(this.reply);

  /// What to show the person.
  final String reply;
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
