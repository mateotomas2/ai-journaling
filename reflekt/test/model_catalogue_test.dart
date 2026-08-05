import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:reflekt/features/settings/ai_settings.dart';
import 'package:reflekt/features/settings/model_catalogue.dart';

/// Which models are worth offering.
///
/// The list used to be four ids written into a release, which goes stale the
/// week after it ships — and the failure lands on whoever asks a question that
/// day. Fetching it means the interesting behaviour is what gets *filtered
/// out*, and what happens when the fetch does not work.
void main() {
  http.Client serving(Object body, {int status = 200}) =>
      MockClient((_) async => http.Response(jsonEncode(body), status));

  Map<String, dynamic> model(
    String id, {
    String? name,
    List<String> supports = const ['tools'],
  }) =>
      {
        'id': id,
        'name': ?name,
        'supported_parameters': supports,
      };

  test('offers the models that can use the journal', () async {
    final catalogue = OpenRouterCatalogue(
      client: serving({
        'data': [
          model('anthropic/claude-sonnet-5', name: 'Claude Sonnet 5'),
          model('openai/gpt-5', name: 'GPT-5'),
        ],
      }),
    );

    expect(
      (await catalogue.models()).map((m) => m.id),
      ['anthropic/claude-sonnet-5', 'openai/gpt-5'],
    );
  });

  test('leaves out models that cannot call tools', () async {
    // A model without tools cannot read a day, look anything up or write a
    // note. Offering it would be a choice that quietly removes half the app.
    final catalogue = OpenRouterCatalogue(
      client: serving({
        'data': [
          model('good/one', name: 'Good', supports: ['tools', 'temperature']),
          model('talker/only', name: 'Talker', supports: ['temperature']),
        ],
      }),
    );

    expect((await catalogue.models()).map((m) => m.id), ['good/one']);
  });

  test('falls back to the built-in list when OpenRouter cannot be reached',
      () async {
    // Being offline is an ordinary state for a journal. It should cost you the
    // choice of model, not the ability to ask anything at all.
    final catalogue = OpenRouterCatalogue(
      client: MockClient((_) async => throw Exception('no signal')),
    );

    expect(
      (await catalogue.models()).map((m) => m.id),
      AiSettings.models.keys,
    );
  });

  test('falls back when the catalogue is unreadable', () async {
    final catalogue = OpenRouterCatalogue(client: serving({'nonsense': true}));

    expect((await catalogue.models()).map((m) => m.id), AiSettings.models.keys);
  });

  test('falls back when nothing listed can use tools', () async {
    // An empty list would leave someone with nothing to pick, which is worse
    // than an out-of-date list they can pick from.
    final catalogue = OpenRouterCatalogue(
      client: serving({
        'data': [model('talker/only', supports: ['temperature'])],
      }),
    );

    expect((await catalogue.models()).map((m) => m.id), AiSettings.models.keys);
  });

  test('falls back on a bad response', () async {
    final catalogue = OpenRouterCatalogue(
      client: serving({'data': []}, status: 503),
    );

    expect((await catalogue.models()).map((m) => m.id), AiSettings.models.keys);
  });

  test('an entry with no name is still offered, by its id', () async {
    // A missing label is not a reason to hide a model someone might want.
    final catalogue = OpenRouterCatalogue(
      client: serving({
        'data': [model('nameless/model')],
      }),
    );

    final only = (await catalogue.models()).single;
    expect(only.id, 'nameless/model');
    expect(only.name, 'nameless/model');
  });

  test('malformed entries are skipped rather than failing the list', () async {
    final catalogue = OpenRouterCatalogue(
      client: serving({
        'data': [
          'not a model',
          {'id': 42, 'supported_parameters': ['tools']},
          model('fine/one', name: 'Fine'),
        ],
      }),
    );

    expect((await catalogue.models()).map((m) => m.id), ['fine/one']);
  });
}
