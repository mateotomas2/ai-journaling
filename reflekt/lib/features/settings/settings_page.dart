import 'package:flutter/material.dart';

import '../../db/journal_database.dart';
import '../lock/change_password_page.dart';
import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import 'ai_settings.dart';
import 'journal_archive.dart';
import 'model_catalogue.dart';
import 'model_page.dart';
import 'spend.dart';
import 'prompt_page.dart';

/// Keys the specs drive. Keep these stable — renaming one breaks a recording.
class SettingsKeys {
  static const apiKeyField = Key('settings_api_key_field');
  static const save = Key('settings_save');
  static const connected = Key('settings_connected');
  static const editPrompt = Key('settings_edit_prompt');
  static const changePassword = Key('settings_change_password');
  static const models = Key('settings_models');
  static const spent = Key('settings_spent');
  static const export = Key('settings_export');
  static const import = Key('settings_import');
  static const archiveSaid = Key('settings_archive_said');

  /// The page itself. Settings holds several scrollables — the model list and
  /// a text field carry their own — so anything reaching for something below
  /// the fold has to say which one it means.
  static const page = Key('settings_page');
  static const chooseModel = Key('settings_choose_model');
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
  Spend _spend = Spend.none;

  /// What happened to the last export or import, in a sentence.
  String? _archiveSaid;

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
    final spend = await Spend.read(widget.database);
    if (!mounted) return;
    setState(() {
      _spend = spend;
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

  /// Where an exported journal is written.
  ///
  /// The app's own external directory: reachable with a file manager or a
  /// cable, and needing no permission to write. A save dialog would be better
  /// and needs a plugin; this gets the file out of the app, which is the part
  /// that matters.
  Future<String> get _archiveDirectory async {
    final external = await getExternalStorageDirectory();
    return (external ?? await getApplicationDocumentsDirectory()).path;
  }

  Future<void> _export() async {
    try {
      final file =
          await JournalArchive.write(widget.database, await _archiveDirectory);
      if (!mounted) return;
      setState(() => _archiveSaid = 'Written to ${file.path}');
    } catch (error) {
      if (!mounted) return;
      setState(() => _archiveSaid = 'Could not write the file: $error');
    }
  }

  Future<void> _import() async {
    try {
      final file = File(
        p.join(await _archiveDirectory, JournalArchive.fileName),
      );
      if (!await file.exists()) {
        if (!mounted) return;
        setState(() => _archiveSaid =
            'No ${JournalArchive.fileName} found. Put one there and try again.');
        return;
      }

      final restored = await JournalArchive.read(widget.database, file);
      if (!mounted) return;
      setState(() => _archiveSaid = 'Brought back $restored '
          '${restored == 1 ? 'entry' : 'entries'}.');
    } on ArchiveUnreadable catch (refused) {
      if (!mounted) return;
      setState(() => _archiveSaid = refused.message);
    } catch (error) {
      if (!mounted) return;
      setState(() => _archiveSaid = 'Could not read the file: $error');
    }
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
              key: SettingsKeys.page,
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
                  const SizedBox(height: 12),
                  // Your own credit, spent on your own questions. Shown here
                  // rather than in the conversation: a journal that prices
                  // each thought is a journal you think less in.
                  Text(
                    key: SettingsKeys.spent,
                    _spend.inWords,
                    style: theme.textTheme.bodySmall,
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
                  _models.isEmpty
                      ? 'Loading the list…'
                      : (_choices.firstWhere((m) => m.id == _model).name),
                  style: theme.textTheme.bodySmall,
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  key: SettingsKeys.chooseModel,
                  onPressed: () => Navigator.of(context)
                      .push(
                        MaterialPageRoute(
                          builder: (_) => ModelPage(
                            database: widget.database,
                            catalogue: widget.catalogue,
                          ),
                        ),
                      )
                      .then((_) => _load()),
                  child: const Text('Choose a model'),
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

                const SizedBox(height: 32),
                Text('Your journal as a file', style: theme.textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(
                  // Said here rather than buried in a decision record. The
                  // journal is encrypted right up until this button, and then
                  // it is not (ADR-0011).
                  'Writes everything you have written to a plain file you can '
                  'read, keep, or open elsewhere. It is not encrypted — anyone '
                  'who can reach the file can read your journal. Your API key '
                  'is never included.',
                  style: theme.textTheme.bodySmall,
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        key: SettingsKeys.export,
                        onPressed: _export,
                        child: const Text('Export'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton(
                        key: SettingsKeys.import,
                        onPressed: _import,
                        child: const Text('Import'),
                      ),
                    ),
                  ],
                ),
                if (_archiveSaid != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    key: SettingsKeys.archiveSaid,
                    _archiveSaid!,
                    style: theme.textTheme.bodySmall,
                  ),
                ],

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
