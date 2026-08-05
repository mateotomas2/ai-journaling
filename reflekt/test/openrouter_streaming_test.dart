import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:reflekt/features/ai/journal_ai.dart';
import 'package:reflekt/features/ai/openrouter_ai.dart';

/// Reading an answer as it is written.
///
/// The transport is stubbed at the byte level rather than with `MockClient`,
/// because what is under test is precisely how bytes arriving in pieces become
/// text on screen — and a stub that hands over a whole response at once would
/// prove none of it. The awkward cases here are real: OpenRouter splits its
/// stream wherever it likes, including mid-line.
void main() {
  /// A client whose response body yields exactly [chunks], in order.
  http.Client streamingClient(
    List<String> chunks, {
    int status = 200,
    void Function(http.BaseRequest request)? onRequest,
  }) =>
      _StubStreamingClient(chunks, status, onRequest);

  String sse(String content) => 'data: ${jsonEncode({
        'choices': [
          {
            'delta': {'content': content},
          }
        ],
      })}\n\n';

  Stream<AiEvent> ask(http.Client client) => OpenRouterAi(
        apiKey: 'sk-or-test',
        client: client,
      ).ask(question: 'what lifted my mood?', entries: ['ran in the rain']);

  test('text arrives in pieces, as it is written', () async {
    final events = await ask(
      streamingClient([sse('Running '), sse('did.'), 'data: [DONE]\n\n']),
    ).toList();

    expect(
      events.whereType<AiText>().map((e) => e.delta),
      ['Running ', 'did.'],
    );
  });

  test('the finished answer is the whole of what was written', () async {
    final events = await ask(
      streamingClient([sse('Running '), sse('did.'), 'data: [DONE]\n\n']),
    ).toList();

    expect(events.whereType<AiFinished>().single.answer.reply, 'Running did.');
  });

  test('a chunk split mid-line is still read correctly', () async {
    // The transport splits wherever it likes. Parsing per chunk rather than
    // per line would drop or corrupt whatever straddled the boundary — and the
    // symptom is an answer missing a word in the middle, which reads as the
    // model being odd rather than as a bug here.
    final whole = sse('Running did.');
    final split = whole.length ~/ 2;

    final events = await ask(
      streamingClient([
        whole.substring(0, split),
        whole.substring(split),
        'data: [DONE]\n\n',
      ]),
    ).toList();

    expect(events.whereType<AiText>().map((e) => e.delta), ['Running did.']);
  });

  test('keep-alive comments and blank lines are ignored', () async {
    // OpenRouter sends ": OPENROUTER PROCESSING" to hold the connection open.
    // Treated as data it would be parsed as JSON and fail the whole answer.
    final events = await ask(
      streamingClient([
        ': OPENROUTER PROCESSING\n\n',
        '\n',
        sse('Fine.'),
        'data: [DONE]\n\n',
      ]),
    ).toList();

    expect(events.whereType<AiText>().map((e) => e.delta), ['Fine.']);
  });

  test('asks the provider to stream', () async {
    late http.BaseRequest seen;
    await ask(
      streamingClient(
        [sse('ok'), 'data: [DONE]\n\n'],
        onRequest: (request) => seen = request,
      ),
    ).toList();

    final body = jsonDecode((seen as http.Request).body) as Map<String, dynamic>;
    expect(body['stream'], isTrue);
  });

  test('a rejected key is a sentence, not a status code', () async {
    // The stream is where failures surface now, and they must still say
    // something the person can act on.
    await expectLater(
      ask(streamingClient(['nope'], status: 401)),
      emitsError(
        isA<JournalAiException>()
            .having((e) => e.message, 'message', contains('Settings')),
      ),
    );
  });

  test('a provider having a bad afternoon is reported as such', () async {
    await expectLater(
      ask(streamingClient(['boom'], status: 503)),
      emitsError(isA<JournalAiException>()),
    );
  });

  test('a stream that dies mid-answer does not look like a complete answer',
      () async {
    // Ending without [DONE] must not emit AiFinished: a truncated reply
    // silently presented as the whole answer is worse than an error.
    final events = <AiEvent>[];
    await expectLater(
      ask(_DyingClient(sse('Running '))).forEach(events.add),
      throwsA(isA<JournalAiException>()),
    );

    expect(events.whereType<AiFinished>(), isEmpty);
  });
}

class _StubStreamingClient extends http.BaseClient {
  _StubStreamingClient(this.chunks, this.status, this.onRequest);

  final List<String> chunks;
  final int status;
  final void Function(http.BaseRequest request)? onRequest;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    onRequest?.call(request);
    return http.StreamedResponse(
      Stream.fromIterable(chunks.map(utf8.encode)),
      status,
    );
  }
}

/// Delivers one chunk and then fails, as a dropped connection does.
class _DyingClient extends http.BaseClient {
  _DyingClient(this.chunk);

  final String chunk;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final controller = StreamController<List<int>>();
    controller.add(utf8.encode(chunk));
    controller.addError(const SocketFailure());
    unawaited(controller.close());
    return http.StreamedResponse(controller.stream, 200);
  }
}

class SocketFailure implements Exception {
  const SocketFailure();
}
