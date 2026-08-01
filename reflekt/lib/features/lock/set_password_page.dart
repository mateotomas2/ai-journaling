import 'package:flutter/material.dart';

/// Keys the specs drive. Keep these stable — renaming one breaks a recording.
class SetPasswordKeys {
  static const field = Key('set_password_field');
  static const submit = Key('set_password_submit');
}

/// First run: choose the password the journal is encrypted with.
class SetPasswordPage extends StatefulWidget {
  const SetPasswordPage({super.key, required this.onChosen});

  final Future<void> Function(String password) onChosen;

  @override
  State<SetPasswordPage> createState() => _SetPasswordPageState();
}

class _SetPasswordPageState extends State<SetPasswordPage> {
  final _controller = TextEditingController();
  bool _busy = false;
  bool _canSubmit = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      final canSubmit = _controller.text.trim().length >= 8;
      if (canSubmit != _canSubmit) setState(() => _canSubmit = canSubmit);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_canSubmit || _busy) return;
    setState(() => _busy = true);
    await widget.onChosen(_controller.text);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Reflekt', style: theme.textTheme.headlineMedium),
              const SizedBox(height: 12),
              Text(
                'Choose a password. It encrypts everything you write.',
                style: theme.textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              TextField(
                key: SetPasswordKeys.field,
                controller: _controller,
                obscureText: true,
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: 'Password',
                  helperText: 'At least 8 characters',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              // Said plainly here rather than buried in a settings screen: this
              // is the cost of a key nobody else can read (ADR-0006).
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.warning_amber_rounded,
                      size: 18, color: theme.colorScheme.error),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'There is no way to reset this. If you forget it, your '
                      'journal cannot be recovered — not by us, not by anyone.',
                      style: theme.textTheme.bodySmall,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              FilledButton(
                key: SetPasswordKeys.submit,
                onPressed: _canSubmit && !_busy ? _submit : null,
                child: _busy
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Create my journal'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
