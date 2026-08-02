import 'dart:convert';

import 'package:http/http.dart' as http;

import 'journal_ai.dart';

/// Talks to OpenRouter.
///
/// The journal's entries are sent to a third party to answer a question. That
/// is the one place this app's privacy promise is deliberately relaxed, and it
/// happens only when the user asks a question — never in the background.
class OpenRouterAi implements JournalAi {
  OpenRouterAi({
    required this.apiKey,
    this.model = 'anthropic/claude-sonnet-4.5',
    http.Client? client,
  }) : _client = client ?? http.Client();

  final String apiKey;
  final String model;
  final http.Client _client;

  static final _endpoint =
      Uri.parse('https://openrouter.ai/api/v1/chat/completions');

  @override
  Future<String> ask({
    required String question,
    required List<String> entries,
    List<Exchange> earlier = const [],
  }) async {
    if (entries.isEmpty) {
      throw const JournalAiException(
        'There is nothing written yet to answer from.',
      );
    }

    final http.Response response;
    try {
      response = await _client.post(
        _endpoint,
        headers: {
          'Authorization': 'Bearer $apiKey',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'model': model,
          'messages': [
            {
              'role': 'system',
              'content':
                  'You answer questions about the journal entries below. Use '
                      'only what they say. If they do not answer the question, '
                      'say so plainly rather than guessing.\n\n'
                      '${entries.join("\n\n")}',
            },
            {'role': 'user', 'content': question},
          ],
        }),
      );
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

    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final choices = body['choices'];
    if (choices is! List || choices.isEmpty) {
      throw const JournalAiException('The AI replied with nothing.');
    }

    final message = (choices.first as Map<String, dynamic>)['message'];
    final content = message is Map<String, dynamic> ? message['content'] : null;

    if (content is! String || content.trim().isEmpty) {
      throw const JournalAiException('The AI replied with nothing.');
    }
    return content.trim();
  }
}
