import 'package:flutter/material.dart';

import '../../db/journal_database.dart';
import '../lock/change_password_page.dart';
import 'ai_settings.dart';
import 'model_catalogue.dart';
import 'prompt_page.dart';

/// Keys the specs drive. Keep these stable — renaming one breaks a recording.
class SettingsKeys {
  static const apiKeyField = Key('settings_api_key_field');
  static const save = Key('settings_save');
  static const connected = Key('settings_connected');
  static const editPrompt = Key('settings_edit_prompt');
  static const changePassword = Key('settings_change_password');
  static const models = Key('settings_models');
  static const loadingModels = Key('settings_loading_models');

  /// One per model, so a spec can name the one it means.
  static Key modelOf(String id) => Key('settings_model_${id.replaceAll("/", "_")}');
}

/// Where the OpenRouter key lives in the database. Namespaced because settings
/// share one table.
const openRouterKeySetting = 'openrouter.api_key';

/// Shows the tail of a key — enough to recognise which one is in use, not
/// enough to use it. A saved key is never displayed again in full: it is a live
/// credential that can spend the owner's money, and nothing here needs to read
/// it back.
String maskApiKey(String key) =>
    key.length <= 6 ? '••••••' : '••••••${key.substring(key.length - 6)}';

class SettingsPage extends StatefulWidget {
  const SettingsPage({
    super.key,
    required this.database,
    this.onChangePassword,
    this.catalogue = const _LiveCatalogue(),
  });

  final JournalDatabase database;

  /// Where the choice of models comes from. Injected so a spec offers a fixed
  /// list rather than whatever OpenRouter is serving today.
  final ModelCatalogue catalogue;

  /// Returns false when the current password is wrong.
  final Future<bool> Function(String current, String replacement)?
      onChangePassword;

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final _controller = TextEditingController();
  String? _savedKey;
  String _model = AiSettings.defaultModel;

  /// What there is to choose from. Starts as the built-in list so the section
  /// is never empty while the real one is being fetched.
  List<AiModel> _models = const [];

  bool _loading = true;
  bool _canSave = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      final canSave = _controller.text.trim().isNotEmpty;
      if (canSave != _canSave) setState(() => _canSave = canSave);
    });
    _load();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final saved = await widget.database.setting(openRouterKeySetting);
    final model = await widget.database.setting(AiSettings.modelSetting);
    if (!mounted) return;
    setState(() {
      _savedKey = saved;
      _model = model ?? AiSettings.defaultModel;
      _loading = false;
    });

    // Fetched after the page is on screen, not before it. Settings has other
    // things in it, and none of them should wait on a network call.
    final models = await widget.catalogue.models();
    if (!mounted) return;
    setState(() => _models = models);
  }

  /// The chosen model, kept in the list even when the catalogue no longer
  /// offers it. Dropping it would silently move someone onto a different model
  /// than the one their journal says they picked.
  List<AiModel> get _choices {
    if (_models.any((model) => model.id == _model)) return _models;
    return [AiModel(_model, _model), ..._models];
  }

  Future<void> _chooseModel(String id) async {
    await widget.database.putSetting(AiSettings.modelSetting, id);
    if (!mounted) return;
    setState(() => _model = id);
  }

  Future<void> _save() async {
    final key = _controller.text.trim();
    if (key.isEmpty) return;
    await widget.database.putSetting(openRouterKeySetting, key);
    if (!mounted) return;
    _controller.clear();
    setState(() => _savedKey = key);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text('OpenRouter', style: theme.textTheme.titleMedium),
                const SizedBox(height: 8),
                Text(
                  'Your own key, used for the AI features. It is stored in your '
                  'encrypted journal, so it is only readable while the journal '
                  'is unlocked.',
                  style: theme.textTheme.bodySmall,
                ),
                const SizedBox(height: 16),
                if (_savedKey != null) ...[
                  Card(
                    key: SettingsKeys.connected,
                    margin: EdgeInsets.zero,
                    child: ListTile(
                      leading: Icon(Icons.check_circle_outline,
                          color: theme.colorScheme.primary),
                      title: const Text('AI is ready'),
                      subtitle: Text(maskApiKey(_savedKey!)),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                TextField(
                  key: SettingsKeys.apiKeyField,
                  controller: _controller,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: _savedKey == null
                        ? 'OpenRouter API key'
                        : 'Replace the key',
                    border: const OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  key: SettingsKeys.save,
                  onPressed: _canSave ? _save : null,
                  child: const Text('Save'),
                ),

                const SizedBox(height: 32),
                Text('Which model answers', style: theme.textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(
                  'Only models that can use the journal are listed — reading a '
                  'day, looking something up, writing a note. They differ in '
                  'cost and in how they write.',
                  style: theme.textTheme.bodySmall,
                ),
                const SizedBox(height: 8),
                if (_models.isEmpty)
                  const Padding(
                    key: SettingsKeys.loadingModels,
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                else
                  SizedBox(
                    // Tall enough to be a list you scroll rather than a page
                    // that never ends. OpenRouter offers hundreds.
                    height: 260,
                    child: RadioGroup<String>(
                      groupValue: _model,
                      onChanged: (id) => id == null ? null : _chooseModel(id),
                      child: ListView(
                        key: SettingsKeys.models,
                        children: [
                          for (final model in _choices)
                            RadioListTile<String>(
                              key: SettingsKeys.modelOf(model.id),
                              title: Text(model.name),
                              value: model.id,
                              contentPadding: EdgeInsets.zero,
                            ),
                        ],
                      ),
                    ),
                  ),

                const SizedBox(height: 24),
                Text('How it is asked', style: theme.textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(
                  'What the AI is told before your entries.',
                  style: theme.textTheme.bodySmall,
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  key: SettingsKeys.editPrompt,
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => PromptPage(database: widget.database),
                    ),
                  ),
                  child: const Text('Edit instructions'),
                ),

                if (widget.onChangePassword != null) ...[
                  const SizedBox(height: 32),
                  Text('Password', style: theme.textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(
                    'Re-encrypts your journal. Everything you have written '
                    'stays where it is.',
                    style: theme.textTheme.bodySmall,
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    key: SettingsKeys.changePassword,
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => ChangePasswordPage(
                          onChange: widget.onChangePassword!,
                        ),
                      ),
                    ),
                    child: const Text('Change password'),
                  ),
                ],
              ],
            ),
    );
  }
}


/// The real catalogue, built lazily so `SettingsPage` can stay `const`.
class _LiveCatalogue implements ModelCatalogue {
  const _LiveCatalogue();

  @override
  Future<List<AiModel>> models() => OpenRouterCatalogue().models();
}
