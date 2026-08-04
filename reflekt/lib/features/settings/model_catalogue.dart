import 'dart:convert';

import 'package:http/http.dart' as http;

import 'ai_settings.dart';

/// A model someone could choose.
class AiModel {
  const AiModel(this.id, this.name);

  /// What OpenRouter calls it. Written into settings, so it must be exact.
  final String id;

  /// What the person reads.
  final String name;
}

/// Where the list of models comes from.
///
/// An interface so a spec can offer a fixed list instead of whatever
/// OpenRouter is serving today — a recording whose options change under it is
/// not evidence of anything.
abstract interface class ModelCatalogue {
  /// The models worth offering, best-known first.
  ///
  /// Never throws. A catalogue that cannot be fetched falls back to the models
  /// built into the app: being offline should cost you the *choice*, not the
  /// ability to ask anything at all.
  Future<List<AiModel>> models();
}

/// The models built into the app.
///
/// Used when OpenRouter cannot be reached, and as the starting point before
/// the real list arrives. Hardcoding was the whole list once; it is a fallback
/// now, because a list written into a release goes stale the week after it
/// ships and the failure lands on whoever asks a question that day.
class BuiltInModels implements ModelCatalogue {
  const BuiltInModels();

  @override
  Future<List<AiModel>> models() async => [
        for (final entry in AiSettings.models.entries)
          AiModel(entry.key, entry.value),
      ];
}

/// OpenRouter's own list, filtered to what this app can actually use.
class OpenRouterCatalogue implements ModelCatalogue {
  OpenRouterCatalogue({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  static final _endpoint = Uri.parse('https://openrouter.ai/api/v1/models');

  /// Needs no key: the catalogue is public. Worth noting, because it means
  /// someone can see what they would be choosing between before they have paid
  /// for anything.
  @override
  Future<List<AiModel>> models() async {
    try {
      final response = await _client.get(_endpoint);
      if (response.statusCode != 200) return const BuiltInModels().models();

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final listed = body['data'];
      if (listed is! List) return const BuiltInModels().models();

      final usable = <AiModel>[];
      for (final entry in listed) {
        if (entry is! Map<String, dynamic>) continue;

        // Models that cannot call tools cannot read a journal, write a note or
        // look anything up — they would be a choice that quietly removes half
        // the app (ADR-0009).
        final supported = entry['supported_parameters'];
        if (supported is! List || !supported.contains('tools')) continue;

        final id = entry['id'];
        if (id is! String || id.isEmpty) continue;

        final name = entry['name'];
        usable.add(AiModel(id, name is String && name.isNotEmpty ? name : id));
      }

      // An empty list would leave someone with nothing to pick, which is worse
      // than an out-of-date list they can pick from.
      if (usable.isEmpty) return const BuiltInModels().models();

      usable.sort((a, b) => a.name.compareTo(b.name));
      return usable;
    } catch (_) {
      // Being offline is an ordinary state for a journal, not an error worth
      // showing. The built-in list still works.
      return const BuiltInModels().models();
    }
  }
}
