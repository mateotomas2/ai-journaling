import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:reflekt/features/ai/journal_ai.dart';
import 'package:reflekt/features/ai/journal_tool.dart';
import 'package:reflekt/features/ai/openrouter_ai.dart';

/// Letting the model act, and getting the result back to it.
///
/// This is the whole reason ADR-0009 gave up the fenced-marker approach: a
/// marker can say "save this", but it cannot carry a *result* back into the
/// conversation, so reading, searching and updating were impossible to build
/// on it. What is under test here is precisely that round trip.
void main() {
  /// One SSE frame carrying a fragment of a tool call.
  ///
  /// Providers stream these in pieces exactly as they stream text: the name
  /// arrives in one frame and the arguments across several, keyed by index.
  String toolFrame({
    required int index,
    String? id,
    String? name,
    String? arguments,
  }) =>
      'data: ${jsonEncode({
            'choices': [
              {
                'delta': {
                  'tool_calls': [
                    {
                      'index': index,
                      'id': ?id,
                      if (name != null || arguments != null)
                        'function': {
                          'name': ?name,
                          'arguments': ?arguments,
                        },
                    }
                  ],
                },
              }
            ],
          })}\n\n';

  String textFrame(String content) => 'data: ${jsonEncode({
        'choices': [
          {
            'delta': {'content': content},
          }
        ],
      })}\n\n';

  const done = 'data: [DONE]\n\n';

  /// Replies with the scripted turns in order, one per HTTP request.
  _Provider providerSaying(List<String> turns) => _Provider(turns);

  Future<List<AiEvent>> ask(
    _Provider provider, {
    List<JournalTool> tools = const [],
  }) =>
      OpenRouterAi(apiKey: 'sk-or-test', client: provider)
          .ask(
            question: 'what did I say about sleep?',
            entries: ['slept badly'],
            tools: tools,
          )
          .toList();

  test('a tool is run and its result answered from', () async {
    final recalled = _FakeTool(
      name: 'search_journal_memory',
      result: 'You wrote about three bad nights.',
    );

    final provider = providerSaying([
      // First turn: the model asks for the tool.
      toolFrame(index: 0, id: 'call_1', name: 'search_journal_memory') +
          toolFrame(index: 0, arguments: '{"query":"sleep"}') +
          done,
      // Second turn: having been given the result, it answers.
      textFrame('Three bad nights.') + done,
    ]);

    final events = await ask(provider, tools: [recalled]);

    expect(recalled.ranWith, {'query': 'sleep'});
    expect(events.whereType<AiFinished>().single.answer.reply,
        'Three bad nights.');
  });

  test('the result is handed back in the next request', () async {
    final recalled = _FakeTool(
      name: 'search_journal_memory',
      result: 'You wrote about three bad nights.',
    );

    final provider = providerSaying([
      toolFrame(index: 0, id: 'call_1', name: 'search_journal_memory') +
          toolFrame(index: 0, arguments: '{"query":"sleep"}') +
          done,
      textFrame('ok') + done,
    ]);

    await ask(provider, tools: [recalled]);

    // The round trip is the point. Without the result in the second request
    // the model is answering from nothing, which looks like a bad model
    // rather than a broken loop.
    final second = jsonDecode(provider.bodies[1]) as Map<String, dynamic>;
    final messages = second['messages'] as List<dynamic>;
    final toolReply = messages.lastWhere((m) => m['role'] == 'tool');

    expect(toolReply['content'], contains('three bad nights'));
    expect(toolReply['tool_call_id'], 'call_1');
  });

  test('arguments split across frames are reassembled', () async {
    // The arguments are streamed as text fragments and are not valid JSON
    // until the last one has arrived. Parsing a fragment would fail the call.
    final wrote = _FakeTool(name: 'write_note', result: 'written');

    final provider = providerSaying([
      toolFrame(index: 0, id: 'call_1', name: 'write_note') +
          toolFrame(index: 0, arguments: '{"content":"Ran ') +
          toolFrame(index: 0, arguments: 'in the rain"}') +
          done,
      textFrame('Saved.') + done,
    ]);

    await ask(provider, tools: [wrote]);

    expect(wrote.ranWith, {'content': 'Ran in the rain'});
  });

  test('two tools asked for at once both run', () async {
    final read = _FakeTool(name: 'read_notes', result: 'one note');
    final wrote = _FakeTool(name: 'write_note', result: 'written');

    final provider = providerSaying([
      toolFrame(index: 0, id: 'call_1', name: 'read_notes') +
          toolFrame(index: 0, arguments: '{}') +
          toolFrame(index: 1, id: 'call_2', name: 'write_note') +
          toolFrame(index: 1, arguments: '{"content":"x"}') +
          done,
      textFrame('Done.') + done,
    ]);

    await ask(provider, tools: [read, wrote]);

    expect(read.ranWith, isNotNull);
    expect(wrote.ranWith, isNotNull);
  });

  test('what the assistant did is reported as it happens', () async {
    final read = _FakeTool(name: 'read_notes', result: 'one note');

    final provider = providerSaying([
      toolFrame(index: 0, id: 'call_1', name: 'read_notes') +
          toolFrame(index: 0, arguments: '{}') +
          done,
      textFrame('You wrote one thing.') + done,
    ]);

    final events = await ask(provider, tools: [read]);

    // Someone watching a pause deserves to know the assistant is reading
    // their journal rather than that it has hung.
    expect(events.whereType<AiToolRan>().single.tool, 'read_notes');
  });

  test('a tool that throws is reported to the model, not to the user',
      () async {
    // A failing tool is something the model can recover from — by saying it
    // could not do the thing, or trying another way. Failing the whole answer
    // would turn a recoverable problem into a dead end.
    final broken = _FakeTool(name: 'read_notes', throws: 'no such day');

    final provider = providerSaying([
      toolFrame(index: 0, id: 'call_1', name: 'read_notes') +
          toolFrame(index: 0, arguments: '{}') +
          done,
      textFrame('I could not read that day.') + done,
    ]);

    final events = await ask(provider, tools: [broken]);

    final second = jsonDecode(provider.bodies[1]) as Map<String, dynamic>;
    final toolReply = (second['messages'] as List<dynamic>)
        .lastWhere((m) => m['role'] == 'tool');

    expect(toolReply['content'], contains('no such day'));
    expect(events.whereType<AiFinished>(), hasLength(1));
  });

  test('a tool the journal does not offer is refused', () async {
    // Models invent tool names. Running one by matching loosely would be a
    // way to call something nobody meant to expose.
    final provider = providerSaying([
      toolFrame(index: 0, id: 'call_1', name: 'delete_everything') +
          toolFrame(index: 0, arguments: '{}') +
          done,
      textFrame('I cannot do that.') + done,
    ]);

    await ask(provider, tools: [_FakeTool(name: 'read_notes', result: 'x')]);

    final second = jsonDecode(provider.bodies[1]) as Map<String, dynamic>;
    final toolReply = (second['messages'] as List<dynamic>)
        .lastWhere((m) => m['role'] == 'tool');

    expect(toolReply['content'], contains('delete_everything'));
  });

  test('the tools are offered to the model', () async {
    final provider = providerSaying([textFrame('hello') + done]);

    await ask(provider, tools: [_FakeTool(name: 'read_notes', result: 'x')]);

    final first = jsonDecode(provider.bodies.single) as Map<String, dynamic>;
    final offered = first['tools'] as List<dynamic>;

    expect(offered.single['function']['name'], 'read_notes');
  });

  test('no tools means no tools field at all', () async {
    // An empty list is not the same as the field being absent: some providers
    // reject `tools: []`.
    final provider = providerSaying([textFrame('hello') + done]);

    await ask(provider);

    final first = jsonDecode(provider.bodies.single) as Map<String, dynamic>;
    expect(first.containsKey('tools'), isFalse);
  });

  test('a model that only ever calls tools is stopped', () async {
    // Left alone this is an infinite loop that spends real money. The ceiling
    // is deliberately low: a journal question that needs more than a handful
    // of lookups is a question that has gone wrong.
    final read = _FakeTool(name: 'read_notes', result: 'again');
    final askingForever = List.filled(
      12,
      toolFrame(index: 0, id: 'call_1', name: 'read_notes') +
          toolFrame(index: 0, arguments: '{}') +
          done,
    );

    await expectLater(
      ask(providerSaying(askingForever), tools: [read]),
      throwsA(isA<JournalAiException>()),
    );
  });
}

/// Replies with one scripted turn per request, and keeps what it was sent.
class _Provider extends http.BaseClient {
  _Provider(this.turns);

  final List<String> turns;
  final bodies = <String>[];

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    bodies.add((request as http.Request).body);
    final turn = bodies.length <= turns.length ? turns[bodies.length - 1] : '';
    return http.StreamedResponse(
      Stream.value(utf8.encode(turn)),
      200,
    );
  }
}

class _FakeTool implements JournalTool {
  _FakeTool({required this.name, this.result, this.throws});

  @override
  final String name;

  final String? result;
  final String? throws;

  Map<String, dynamic>? ranWith;

  @override
  String get purpose => 'a fake tool';

  @override
  Map<String, dynamic> get parameters => const {'type': 'object'};

  @override
  Future<String> run(Map<String, dynamic> arguments) async {
    ranWith = arguments;
    if (throws != null) throw Exception(throws);
    return result!;
  }
}
