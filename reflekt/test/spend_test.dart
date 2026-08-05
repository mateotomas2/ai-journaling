import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:reflekt/features/ai/journal_ai.dart';
import 'package:reflekt/features/ai/journal_tool.dart';
import 'package:reflekt/features/ai/openrouter_ai.dart';

/// What an answer cost.
///
/// This matters more than it did before tools: one message can now fan out
/// into several requests, each billed, so the cost of a conversation is no
/// longer the cost of what you can see on screen.
void main() {
  String textFrame(String content) => 'data: ${jsonEncode({
        'choices': [
          {
            'delta': {'content': content},
          }
        ],
      })}\n\n';

  String usageFrame(double cost) => 'data: ${jsonEncode({
        'choices': [],
        'usage': {
          'prompt_tokens': 100,
          'completion_tokens': 20,
          'total_tokens': 120,
          'cost': cost,
        },
      })}\n\n';

  String toolFrame({required int index, String? name, String? arguments}) =>
      'data: ${jsonEncode({
            'choices': [
              {
                'delta': {
                  'tool_calls': [
                    {
                      'index': index,
                      'id': 'call_1',
                      if (name != null || arguments != null)
                        'function': {'name': ?name, 'arguments': ?arguments},
                    }
                  ],
                },
              }
            ],
          })}\n\n';

  const done = 'data: [DONE]\n\n';

  Future<List<AiEvent>> ask(
    _Provider provider, {
    List<JournalTool> tools = const [],
  }) =>
      OpenRouterAi(apiKey: 'sk-or-test', client: provider)
          .ask(question: 'why?', entries: ['because'], tools: tools)
          .toList();

  test('an answer reports what it cost', () async {
    final events = await ask(
      _Provider([textFrame('Because.') + usageFrame(0.0042) + done]),
    );

    expect(events.whereType<AiSpent>().single.cost, closeTo(0.0042, 1e-9));
  });

  test('a usage frame is not mistaken for an empty answer', () async {
    // The frame carries `choices: []`, which the text parser has to ignore
    // rather than read as the model having said nothing.
    final events = await ask(
      _Provider([textFrame('Because.') + usageFrame(0.001) + done]),
    );

    expect(events.whereType<AiFinished>().single.answer.reply, 'Because.');
  });

  test('the whole tool loop is counted, not just the last request', () async {
    // The point of the issue. One message, several billed requests — a total
    // that only counted the final one would understate what a conversation
    // costs by however much the looking-up cost.
    final tool = _FakeTool();
    final events = await ask(
      _Provider([
        toolFrame(index: 0, name: 'read_notes') +
            toolFrame(index: 0, arguments: '{}') +
            usageFrame(0.003) +
            done,
        textFrame('One thing.') + usageFrame(0.002) + done,
      ]),
      tools: [tool],
    );

    final spent =
        events.whereType<AiSpent>().fold(0.0, (sum, e) => sum + e.cost);
    expect(spent, closeTo(0.005, 1e-9));
  });

  test('a provider that reports no cost is not counted as free', () async {
    // Some providers omit cost. Recording 0 would quietly understate the
    // total, which is worse than admitting it is not known — so nothing is
    // emitted at all.
    final events = await ask(
      _Provider([textFrame('Because.') + done]),
    );

    expect(events.whereType<AiSpent>(), isEmpty);
  });

  test('asks the provider to report usage', () async {
    final provider = _Provider([textFrame('ok') + done]);
    await ask(provider);

    final body = jsonDecode(provider.bodies.single) as Map<String, dynamic>;
    expect(body['usage'], {'include': true});
  });
}

class _Provider extends http.BaseClient {
  _Provider(this.turns);

  final List<String> turns;
  final bodies = <String>[];

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    bodies.add((request as http.Request).body);
    final turn = bodies.length <= turns.length ? turns[bodies.length - 1] : '';
    return http.StreamedResponse(Stream.value(utf8.encode(turn)), 200);
  }
}

class _FakeTool implements JournalTool {
  @override
  String get name => 'read_notes';

  @override
  String get purpose => 'a fake tool';

  @override
  Map<String, dynamic> get parameters => const {'type': 'object'};

  @override
  Future<String> run(Map<String, dynamic> arguments) async => 'one note';
}
