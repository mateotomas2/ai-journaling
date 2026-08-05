import 'dart:convert';

import 'package:http/http.dart' as http;

import '../settings/ai_settings.dart';
import 'journal_ai.dart';
import 'journal_tool.dart';

/// Talks to OpenRouter.
///
/// The journal's entries are sent to a third party to answer a question. That
/// is the one place this app's privacy promise is deliberately relaxed, and it
/// happens only when the user asks a question — never in the background.
class OpenRouterAi implements JournalAi {
  OpenRouterAi({
    required this.apiKey,
    this.model = 'anthropic/claude-sonnet-4.5',
    this.systemPrompt,
    http.Client? client,
  }) : _client = client ?? http.Client();

  final String apiKey;
  final String model;

  /// What the model is told before the entries. Null uses the built-in.
  final String? systemPrompt;
  final http.Client _client;

  static final _endpoint =
      Uri.parse('https://openrouter.ai/api/v1/chat/completions');

  /// How many times the assistant may act before answering.
  ///
  /// A model that only ever calls tools is an infinite loop that spends real
  /// money. The ceiling is deliberately low: a question about a journal that
  /// needs more than a handful of lookups is a question that has gone wrong.
  static const _mostActionsPerAnswer = 8;

  @override
  Stream<AiEvent> ask({
    required String question,
    required List<String> entries,
    List<Exchange> earlier = const [],
    List<JournalTool> tools = const [],
  }) async* {
    // With tools, an empty day is not an empty journal: the assistant can go
    // and look. Without them there is genuinely nothing to answer from, and
    // asking anyway would spend money to be told nothing.
    if (entries.isEmpty && tools.isEmpty) {
      throw const JournalAiException(
        'There is nothing written yet to answer from.',
      );
    }

    final byName = {for (final tool in tools) tool.name: tool};

    // The conversation as the provider sees it. It grows as the assistant acts
    // — each request carries everything that has happened so far, because the
    // provider holds no state between them.
    final conversation = <Map<String, dynamic>>[
      {
        'role': 'system',
        'content': '${systemPrompt ?? AiSettings.defaultPrompt}'
            '\n\n${entries.join("\n\n")}',
      },
      for (final exchange in earlier) ...[
        {'role': 'user', 'content': exchange.question},
        {'role': 'assistant', 'content': exchange.answer},
      ],
      {'role': 'user', 'content': question},
    ];

    for (var turn = 0; turn <= _mostActionsPerAnswer; turn++) {
      final turnResult = _Turn();

      await for (final event in _oneTurn(conversation, tools, turnResult)) {
        yield event;
      }

      // Nothing more to do: the assistant talked rather than acted.
      if (turnResult.calls.isEmpty) {
        final reply = turnResult.text.toString().trim();
        if (reply.isEmpty) {
          throw const JournalAiException('The AI replied with nothing.');
        }
        yield AiFinished(Answer(reply));
        return;
      }

      // What it asked for, said back to it, so the next request carries the
      // request as well as the results.
      conversation.add({
        'role': 'assistant',
        'content': turnResult.text.toString(),
        'tool_calls': [
          for (final call in turnResult.calls.values)
            {
              'id': call.id,
              'type': 'function',
              'function': {'name': call.name, 'arguments': call.arguments},
            },
        ],
      });

      for (final call in turnResult.calls.values) {
        conversation.add({
          'role': 'tool',
          'tool_call_id': call.id,
          'content': await _run(byName[call.name], call),
        });
        yield AiToolRan(call.name);
      }
    }

    throw const JournalAiException(
      'The assistant kept looking things up without answering. Try asking '
      'again, more plainly.',
    );
  }

  /// Runs one tool and describes the outcome for the model to read.
  ///
  /// A failure is reported back rather than thrown: the model can recover from
  /// "that day has nothing on it" by saying so, where failing the whole answer
  /// turns a recoverable problem into a dead end. An unknown name is refused
  /// outright — models invent tools, and matching loosely would be a way to
  /// reach something nobody meant to expose.
  Future<String> _run(JournalTool? tool, _ToolCall call) async {
    if (tool == null) {
      return 'There is no tool called ${call.name}. '
          'Answer without it, or say what you cannot do.';
    }
    try {
      final arguments = call.arguments.trim().isEmpty
          ? <String, dynamic>{}
          : jsonDecode(call.arguments) as Map<String, dynamic>;
      return await tool.run(arguments);
    } catch (error) {
      return 'That did not work: $error';
    }
  }

  /// One request, and everything it streamed back.
  Stream<AiEvent> _oneTurn(
    List<Map<String, dynamic>> conversation,
    List<JournalTool> tools,
    _Turn into,
  ) async* {
    final request = http.Request('POST', _endpoint)
      ..headers.addAll({
        'Authorization': 'Bearer $apiKey',
        'Content-Type': 'application/json',
      })
      ..body = jsonEncode({
        'model': model,
        'stream': true,
        'messages': conversation,
        // Omitted rather than sent empty: some providers reject `tools: []`.
        if (tools.isNotEmpty)
          'tools': [for (final tool in tools) toolSchema(tool)],
      });

    final http.StreamedResponse response;
    try {
      response = await _client.send(request);
    } catch (_) {
      // Deliberately not surfacing the underlying error: it is usually a socket
      // message that tells the reader nothing they can act on.
      throw const JournalAiException(
        'Could not reach the AI. Check your connection and try again.',
      );
    }

    if (response.statusCode == 401 || response.statusCode == 403) {
      throw const JournalAiException(
        'OpenRouter rejected that key. Check it in Settings.',
      );
    }
    if (response.statusCode != 200) {
      throw JournalAiException(
        'The AI could not answer just now (${response.statusCode}).',
      );
    }

    final written = StringBuffer();
    var complete = false;

    // Decoded as a character stream rather than chunk by chunk: a chunk can
    // split a multi-byte character, and decoding the halves separately turns a
    // perfectly good answer into replacement characters.
    final stream = utf8.decoder.bind(response.stream);

    // Whatever arrived after the last newline. Events are delimited by lines
    // and the transport splits wherever it likes — including mid-line — so a
    // partial line is carried forward rather than parsed.
    var carried = '';

    try {
      await for (final chunk in stream) {
        final lines = (carried + chunk).split('\n');
        carried = lines.removeLast();

        for (final line in lines) {
          final event = line.trim();

          // Blank lines separate events, and a line starting with ':' is a
          // comment — OpenRouter sends ": OPENROUTER PROCESSING" to hold the
          // connection open. Parsed as data it would fail the whole answer.
          if (event.isEmpty || event.startsWith(':')) continue;
          if (!event.startsWith('data:')) continue;

          final payload = event.substring(5).trim();
          if (payload == '[DONE]') {
            complete = true;
            break;
          }

          final delta = _textOf(payload);
          if (delta != null && delta.isNotEmpty) {
            written.write(delta);
            into.text.write(delta);
            yield AiText(delta);
          }

          _collectToolCalls(payload, into);
        }
        if (complete) break;
      }
    } on JournalAiException {
      rethrow;
    } catch (_) {
      throw const JournalAiException(
        'Could not reach the AI. Check your connection and try again.',
      );
    }

    // A stream that stopped without saying it was done carries a truncated
    // answer. Presenting it as a whole one would be the journal inventing an
    // ending, which is worse than admitting the call failed.
    if (!complete) {
      throw const JournalAiException(
        'The answer stopped part-way. Try asking again.',
      );
    }
  }

  /// Gathers a streamed tool call into [into].
  ///
  /// The pieces arrive across frames exactly as text does: the name in one,
  /// the arguments in fragments after it, tied together by `index`. The
  /// arguments are not valid JSON until the last fragment lands, so they are
  /// accumulated as text and parsed only once the turn is over — parsing a
  /// fragment would fail every call with arguments longer than a frame.
  static void _collectToolCalls(String payload, _Turn into) {
    try {
      final body = jsonDecode(payload) as Map<String, dynamic>;
      final choices = body['choices'];
      if (choices is! List || choices.isEmpty) return;

      final delta = (choices.first as Map<String, dynamic>)['delta'];
      if (delta is! Map<String, dynamic>) return;

      final calls = delta['tool_calls'];
      if (calls is! List) return;

      for (final entry in calls) {
        if (entry is! Map<String, dynamic>) continue;
        final index = entry['index'] as int? ?? 0;
        final call = into.calls.putIfAbsent(index, _ToolCall.new);

        final id = entry['id'];
        if (id is String && id.isNotEmpty) call.id = id;

        final function = entry['function'];
        if (function is! Map<String, dynamic>) continue;

        final name = function['name'];
        if (name is String && name.isNotEmpty) call.name = name;

        final arguments = function['arguments'];
        if (arguments is String) call.arguments += arguments;
      }
    } catch (_) {
      // A frame that does not parse carries nothing worth having.
    }
  }

  /// The text carried by one `data:` payload, or null when it carries none.
  ///
  /// A frame that does not parse is skipped rather than thrown: providers send
  /// frames carrying only a role, a finish reason or usage figures, and failing
  /// an otherwise good answer over one of those would be absurd.
  static String? _textOf(String payload) {
    try {
      final body = jsonDecode(payload) as Map<String, dynamic>;
      final choices = body['choices'];
      if (choices is! List || choices.isEmpty) return null;

      final delta = (choices.first as Map<String, dynamic>)['delta'];
      if (delta is! Map<String, dynamic>) return null;

      final content = delta['content'];
      return content is String ? content : null;
    } catch (_) {
      return null;
    }
  }

}

/// Everything one request streamed back.
class _Turn {
  /// What the assistant said this turn. Usually empty when it is acting.
  final text = StringBuffer();

  /// What it asked to do, by the index the provider streamed it under.
  final calls = <int, _ToolCall>{};
}

/// One tool call, assembled from the frames that carried it.
class _ToolCall {
  String id = '';
  String name = '';

  /// JSON, but only once the last fragment has arrived.
  String arguments = '';
}
