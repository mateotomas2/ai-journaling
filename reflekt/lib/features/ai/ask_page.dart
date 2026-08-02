import 'package:flutter/material.dart';

import '../../db/journal_database.dart';
import 'journal_ai.dart';

/// Keys the specs drive. Keep these stable — renaming one breaks a recording.
class AskKeys {
  static const field = Key('ask_field');
  static const submit = Key('ask_submit');
  static const answer = Key('ask_answer');
  static const error = Key('ask_error');
}

/// Asks a question of everything written so far.
class AskPage extends StatefulWidget {
  const AskPage({super.key, required this.database, required this.ai});

  final JournalDatabase database;
  final JournalAi ai;

  @override
  State<AskPage> createState() => _AskPageState();
}

class _AskPageState extends State<AskPage> {
  final _controller = TextEditingController();
  String? _asked;
  String? _answer;
  String? _error;
  bool _thinking = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _ask() async {
    final question = _controller.text.trim();
    if (question.isEmpty || _thinking) return;

    // The field is cleared and the question re-shown below, so it reads as a
    // question and an answer rather than an input box echoing itself. Leaving
    // the text in place put the same sentence on screen twice.
    _controller.clear();
    setState(() {
      _asked = question;
      _answer = null;
      _error = null;
      _thinking = true;
    });

    try {
      final entries = await widget.database.allNoteContents();
      final answer = await widget.ai.ask(question: question, entries: entries);
      if (!mounted) return;
      setState(() {
        _answer = answer;
        _thinking = false;
      });
    } on JournalAiException catch (failure) {
      if (!mounted) return;
      setState(() {
        _error = failure.message;
        _thinking = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Ask your journal')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          TextField(
            key: AskKeys.field,
            controller: _controller,
            autofocus: true,
            maxLines: null,
            onSubmitted: (_) => _ask(),
            decoration: const InputDecoration(
              hintText: 'What would you like to know?',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton(
            key: AskKeys.submit,
            onPressed: _thinking ? null : _ask,
            child: const Text('Ask'),
          ),
          const SizedBox(height: 24),

          // The question stays on screen beside the answer: an answer alone is
          // hard to judge once you have forgotten exactly how you phrased it.
          if (_asked != null) ...[
            Text(_asked!, style: theme.textTheme.titleMedium),
            const SizedBox(height: 12),
          ],

          if (_thinking) const Center(child: CircularProgressIndicator()),

          if (_error != null)
            Card(
              key: AskKeys.error,
              margin: EdgeInsets.zero,
              color: theme.colorScheme.errorContainer,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  _error!,
                  style: TextStyle(color: theme.colorScheme.onErrorContainer),
                ),
              ),
            ),

          if (_answer != null)
            Card(
              key: AskKeys.answer,
              margin: EdgeInsets.zero,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(_answer!, style: theme.textTheme.bodyLarge),
              ),
            ),
        ],
      ),
    );
  }
}
