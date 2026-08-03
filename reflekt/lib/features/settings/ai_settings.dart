/// The AI settings a person can change, and their defaults.
///
/// Stored in the encrypted journal beside the API key: the instructions someone
/// writes for their own journal say something about them, and belong with the
/// entries rather than in shared preferences.
class AiSettings {
  const AiSettings._();

  static const modelSetting = 'openrouter.model';
  static const promptSetting = 'openrouter.system_prompt';

  /// A small curated list rather than OpenRouter's full catalogue. Hundreds of
  /// models is a menu nobody can choose from, and most of them are wrong for
  /// reading someone's journal.
  static const models = <String, String>{
    'anthropic/claude-sonnet-4.5': 'Claude Sonnet 4.5',
    'anthropic/claude-haiku-4.5': 'Claude Haiku 4.5 (faster, cheaper)',
    'openai/gpt-4.1': 'GPT-4.1',
    'google/gemini-2.5-flash': 'Gemini 2.5 Flash (faster, cheaper)',
  };

  static const defaultModel = 'anthropic/claude-sonnet-4.5';

  /// Deliberately plain, and deliberately editable. The default tells the model
  /// to answer only from what is written and to say when the journal does not
  /// answer the question — an assistant that fills gaps with invention is worse
  /// than useless when the subject is your own life.
  static const defaultPrompt =
      'You answer questions about the journal entries below. Use only what they '
      'say. If they do not answer the question, say so plainly rather than '
      'guessing.\n\n'
      'If — and only if — the person explicitly asks you to save, write or note '
      'something down, end your reply with the text to save in a fenced block '
      'marked `note`. Never do this unprompted: answering a question is not a '
      'reason to record anything.';
}
