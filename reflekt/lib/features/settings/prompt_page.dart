import 'package:flutter/material.dart';

import '../../db/journal_database.dart';
import 'ai_settings.dart';

/// Keys the specs drive. Keep these stable — renaming one breaks a recording.
class PromptKeys {
  static const field = Key('prompt_field');
  static const save = Key('prompt_save');
  static const reset = Key('prompt_reset');
}

/// Editing what the AI is told before your entries.
///
/// Its own screen rather than a box inside settings: this is several lines of
/// prose, and a cramped field near the bottom of a long list — with the
/// keyboard covering the buttons that act on it — is a poor place to write
/// anything. The note composer gets a whole screen for the same reason.
class PromptPage extends StatefulWidget {
  const PromptPage({super.key, required this.database});

  final JournalDatabase database;

  @override
  State<PromptPage> createState() => _PromptPageState();
}

class _PromptPageState extends State<PromptPage> {
  final _controller = TextEditingController();
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final saved = await widget.database.setting(AiSettings.promptSetting);
    if (!mounted) return;
    setState(() {
      _controller.text = saved ?? AiSettings.defaultPrompt;
      _loading = false;
    });
  }

  Future<void> _save() async {
    await widget.database.putSetting(
      AiSettings.promptSetting,
      _controller.text.trim(),
    );
    if (!mounted) return;
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('How it is asked'),
        actions: [
          // Always reachable. A custom prompt is a way to make the assistant
          // useless, and one broken by your own edit with no way back is worse
          // than one that was never editable.
          TextButton(
            key: PromptKeys.reset,
            onPressed: () =>
                setState(() => _controller.text = AiSettings.defaultPrompt),
            child: const Text('Reset'),
          ),
          TextButton(
            key: PromptKeys.save,
            onPressed: _loading ? null : _save,
            child: const Text('Save'),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'These instructions are given to the AI before your entries.',
                    style: theme.textTheme.bodySmall,
                  ),
                  const SizedBox(height: 16),
                  Expanded(
                    child: TextField(
                      key: PromptKeys.field,
                      controller: _controller,
                      maxLines: null,
                      expands: true,
                      textAlignVertical: TextAlignVertical.top,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
