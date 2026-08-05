/// Something the assistant can do to the journal.
///
/// The model asks for one by name and the journal decides whether to run it —
/// never the other way round. A tool is the only way anything the model says
/// reaches the database (ADR-0009); text is text.
abstract interface class JournalTool {
  /// How the model refers to it. Stable: it is written into conversations.
  String get name;

  /// What it is for, in a sentence, addressed to the model. This is the whole
  /// of what the model knows about when to reach for it, so it is closer to
  /// documentation than to a label.
  String get purpose;

  /// JSON Schema for the arguments.
  Map<String, dynamic> get parameters;

  /// Does the thing, and describes the outcome for the model to read.
  ///
  /// The return value goes back into the conversation, so it is written for a
  /// reader: "no notes on that day" tells the model something it can say,
  /// where `[]` invites it to guess.
  Future<String> run(Map<String, dynamic> arguments);
}

/// How a tool is offered to the model.
Map<String, dynamic> toolSchema(JournalTool tool) => {
      'type': 'function',
      'function': {
        'name': tool.name,
        'description': tool.purpose,
        'parameters': tool.parameters,
      },
    };
