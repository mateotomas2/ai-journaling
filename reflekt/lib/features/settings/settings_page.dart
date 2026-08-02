import 'package:flutter/material.dart';

import '../../db/journal_database.dart';

/// Keys the specs drive. Keep these stable — renaming one breaks a recording.
class SettingsKeys {
  static const apiKeyField = Key('settings_api_key_field');
  static const save = Key('settings_save');
  static const connected = Key('settings_connected');
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
  const SettingsPage({super.key, required this.database});

  final JournalDatabase database;

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final _controller = TextEditingController();
  String? _savedKey;
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
    if (!mounted) return;
    setState(() {
      _savedKey = saved;
      _loading = false;
    });
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
              ],
            ),
    );
  }
}
