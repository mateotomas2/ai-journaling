import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:reflekt/features/ai/journal_ai.dart';
import 'package:reflekt/features/ai/openrouter_ai.dart';

/// The OpenRouter client, against a stubbed transport.
///
/// Note-writing is not here any more: a reply is only ever words, and anything
/// that reaches the journal goes through a tool (ADR-0009). The round trip that
/// replaced it lives in `tool_loop_test.dart`.
///
/// The failure paths matter more than the happy one here. An AI call fails in
/// ordinary ways — no signal, a key that has been revoked, a provider having a
/// bad afternoon — and each needs to become a sentence someone can act on
/// rather than a status code.
void main() {
  OpenRouterAi aiThatReturns(http.Response response) => OpenRouterAi(
        apiKey: 'sk-or-test',
        client: MockClient((_) async => response),
      );

  /// A whole answer, delivered as one streamed frame followed by `[DONE]`.
  /// How the stream is *split* is covered by `openrouter_streaming_test.dart`;
  /// what is under test here is what the answer means once it has arrived.
  http.Response reply(String content) => http.Response(
        'data: ${jsonEncode({
              'choices': [
                {
                  'delta': {'content': content},
                }
              ],
            })}\n\ndata: [DONE]\n\n',
        200,
      );

  /// Drains the stream down to the finished answer, which is what these tests
  /// are about.
  Future<Answer> ask(OpenRouterAi ai) async {
    final events = await ai
        .ask(question: 'what lifted my mood?', entries: ['ran in the rain'])
        .toList();
    return events.whereType<AiFinished>().single.answer;
  }

  test('returns the answer', () async {
    expect((await ask(aiThatReturns(reply('Running did.')))).reply, 'Running did.');
  });

  test('sends the entries and the question', () async {
    late Map<String, dynamic> sent;
    final ai = OpenRouterAi(
      apiKey: 'sk-or-test',
      client: MockClient((request) async {
        sent = jsonDecode(request.body) as Map<String, dynamic>;
        expect(request.headers['Authorization'], 'Bearer sk-or-test');
        return reply('ok');
      }),
    );

    // Drained, not merely called: a stream does nothing until something
    // listens, so an un-consumed `ask` never sends the request at all.
    await ai.ask(question: 'why?', entries: ['because']).toList();

    final messages = sent['messages'] as List<dynamic>;
    expect(messages.first['content'], contains('because'));
    expect(messages.last['content'], 'why?');
  });

  test('says so plainly when the key is rejected', () async {
    // 401 is the one failure the user can actually fix, so it must point at
    // where to fix it instead of reporting a number.
    await expectLater(
      ask(aiThatReturns(http.Response('nope', 401))),
      throwsA(
        isA<JournalAiException>().having(
          (e) => e.message,
          'message',
          contains('Settings'),
        ),
      ),
    );
  });

  test('survives a provider having a bad afternoon', () async {
    await expectLater(
      ask(aiThatReturns(http.Response('boom', 503))),
      throwsA(isA<JournalAiException>()),
    );
  });

  test('does not present an empty reply as an answer', () async {
    // A blank answer rendered as an answer looks like the journal had nothing
    // to say, which is a different and more discouraging claim.
    await expectLater(
      ask(aiThatReturns(reply('   '))),
      throwsA(isA<JournalAiException>()),
    );
  });

  test('turns a dead connection into something readable', () async {
    final ai = OpenRouterAi(
      apiKey: 'sk-or-test',
      client: MockClient((_) async => throw const SocketFailure()),
    );

    await expectLater(
      ask(ai),
      throwsA(
        isA<JournalAiException>().having(
          (e) => e.message,
          'message',
          contains('connection'),
        ),
      ),
    );
  });

  test('refuses to ask about an empty journal', () async {
    // Sending no context would spend money to be told nothing.
    await expectLater(
      aiThatReturns(reply('anything'))
          .ask(question: 'why?', entries: const [])
          .toList(),
      throwsA(isA<JournalAiException>()),
    );
  });
}

class SocketFailure implements Exception {
  const SocketFailure();
}
