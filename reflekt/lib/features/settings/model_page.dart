import 'package:flutter/material.dart';

import '../../db/journal_database.dart';
import 'ai_settings.dart';
import 'model_catalogue.dart';
import 'settings_page.dart' show SettingsKeys;

/// Choosing which model answers.
///
/// Its own screen rather than a box inside Settings. A scrollable list nested
/// in a scrolling page swallows any drag aimed at the middle of the screen —
/// the page underneath simply does not move, which reads as Settings being
/// stuck. OpenRouter offers hundreds of models, so this list will always be
/// long enough to have that problem.
class ModelPage extends StatefulWidget {
  const ModelPage({
    super.key,
    required this.database,
    required this.catalogue,
  });

  final JournalDatabase database;
  final ModelCatalogue catalogue;

  @override
  State<ModelPage> createState() => _ModelPageState();
}

class _ModelPageState extends State<ModelPage> {
  List<AiModel> _models = const [];
  String _chosen = AiSettings.defaultModel;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final chosen = await widget.database.setting(AiSettings.modelSetting);
    if (mounted) {
      setState(() => _chosen = chosen ?? AiSettings.defaultModel);
    }

    final models = await widget.catalogue.models();
    if (!mounted) return;
    setState(() {
      _models = models;
      _loading = false;
    });
  }

  /// The chosen model stays listed even when the catalogue no longer offers
  /// it. Dropping it would quietly move someone onto a different model than
  /// the one their journal says they picked.
  List<AiModel> get _choices {
    if (_models.any((model) => model.id == _chosen)) return _models;
    return [AiModel(_chosen, _chosen), ..._models];
  }

  Future<void> _choose(String id) async {
    await widget.database.putSetting(AiSettings.modelSetting, id);
    if (!mounted) return;
    setState(() => _chosen = id);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Which model answers')),
      body: _loading
          ? const Center(
              key: SettingsKeys.loadingModels,
              child: CircularProgressIndicator(),
            )
          : RadioGroup<String>(
              groupValue: _chosen,
              onChanged: (id) => id == null ? null : _choose(id),
              child: ListView(
                key: SettingsKeys.models,
                padding: const EdgeInsets.symmetric(vertical: 8),
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                    child: Text(
                      'Only models that can use the journal are listed — '
                      'reading a day, looking something up, writing a note. '
                      'They differ in cost and in how they write.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                  for (final model in _choices)
                    RadioListTile<String>(
                      key: SettingsKeys.modelOf(model.id),
                      title: Text(model.name),
                      value: model.id,
                    ),
                ],
              ),
            ),
    );
  }
}
