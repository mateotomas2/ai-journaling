import 'package:flutter/material.dart';

/// Keys the specs drive. Keep these stable — renaming one breaks a recording.
class ForgottenPasswordKeys {
  static const explanation = Key('forgotten_explanation');
  static const clear = Key('forgotten_clear');
  static const confirm = Key('forgotten_confirm');
}

/// A dead end with an exit.
///
/// There is no recovery by design (ADR-0006), so this does not pretend to
/// offer one. It says so plainly and then offers the only thing that is
/// actually possible: clearing the journal and starting again.
class ForgottenPasswordPage extends StatefulWidget {
  const ForgottenPasswordPage({super.key, required this.onClear});

  final Future<void> Function() onClear;

  @override
  State<ForgottenPasswordPage> createState() => _ForgottenPasswordPageState();
}

class _ForgottenPasswordPageState extends State<ForgottenPasswordPage> {
  bool _confirming = false;
  bool _clearing = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Forgotten password')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(
            key: ForgottenPasswordKeys.explanation,
            'Your journal is encrypted with your password. We never had it, and '
            'there is no copy of it anywhere — which is what stops anyone else '
            'reading what you wrote.\n\n'
            'It also means a forgotten password cannot be recovered. Not by us, '
            'not by anyone. Without it, what is on this device cannot be read '
            'again.',
            style: theme.textTheme.bodyLarge,
          ),
          const SizedBox(height: 32),
          Text('Starting again', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(
            'You can clear this journal and begin a new one. Everything written '
            'so far is destroyed.',
            style: theme.textTheme.bodyMedium,
          ),
          const SizedBox(height: 20),

          if (!_confirming)
            OutlinedButton(
              key: ForgottenPasswordKeys.clear,
              onPressed: () => setState(() => _confirming = true),
              child: const Text('Clear this journal'),
            )
          else
            Card(
              color: theme.colorScheme.errorContainer,
              margin: EdgeInsets.zero,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'This destroys every note in this journal. It cannot be '
                      'undone.',
                      style: TextStyle(
                        color: theme.colorScheme.onErrorContainer,
                      ),
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      key: ForgottenPasswordKeys.confirm,
                      style: FilledButton.styleFrom(
                        backgroundColor: theme.colorScheme.error,
                        foregroundColor: theme.colorScheme.onError,
                      ),
                      onPressed: _clearing
                          ? null
                          : () async {
                              setState(() => _clearing = true);
                              await widget.onClear();
                            },
                      child: _clearing
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Yes, destroy it'),
                    ),
                    TextButton(
                      onPressed:
                          _clearing ? null : () => setState(() => _confirming = false),
                      child: const Text('Keep trying to remember'),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
