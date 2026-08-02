import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:reflekt/features/ai/journal_ai.dart';
import 'package:reflekt/features/ai/openrouter_ai.dart';

/// The OpenRouter client, against a stubbed transport.
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

  http.Response reply(String content) => http.Response(
        jsonEncode({
          'choices': [
            {
              'message': {'content': content},
            }
          ],
        }),
        200,
      );

  Future<String> ask(OpenRouterAi ai) =>
      ai.ask(question: 'what lifted my mood?', entries: ['ran in the rain']);

  test('returns the answer', () async {
    expect(await ask(aiThatReturns(reply('Running did.'))), 'Running did.');
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

    await ai.ask(question: 'why?', entries: ['because']);

    final messages = sent['messages'] as List<dynamic>;
    expect(messages.first['content'], contains('because'));
    expect(messages.last['content'], 'why?');
  });

  test('says so plainly when the key is rejected', () async {
    // 401 is the one failure the user can actually fix, so it must point at
    // where to fix it instead of reporting a number.
    await expectLater(
      () => ask(aiThatReturns(http.Response('nope', 401))),
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
      () => ask(aiThatReturns(http.Response('boom', 503))),
      throwsA(isA<JournalAiException>()),
    );
  });

  test('does not present an empty reply as an answer', () async {
    // A blank answer rendered as an answer looks like the journal had nothing
    // to say, which is a different and more discouraging claim.
    await expectLater(
      () => ask(aiThatReturns(reply('   '))),
      throwsA(isA<JournalAiException>()),
    );
  });

  test('turns a dead connection into something readable', () async {
    final ai = OpenRouterAi(
      apiKey: 'sk-or-test',
      client: MockClient((_) async => throw const SocketFailure()),
    );

    await expectLater(
      () => ask(ai),
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
      () => aiThatReturns(reply('anything'))
          .ask(question: 'why?', entries: const []),
      throwsA(isA<JournalAiException>()),
    );
  });
}

class SocketFailure implements Exception {
  const SocketFailure();
}
