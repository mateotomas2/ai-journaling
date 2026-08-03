import 'package:flutter/material.dart';

/// Keys the specs drive. Keep these stable — renaming one breaks a recording.
class UnlockKeys {
  static const field = Key('unlock_field');
  static const submit = Key('unlock_submit');
  static const error = Key('unlock_error');
  static const forgotten = Key('unlock_forgotten');
  static const biometric = Key('unlock_biometric');
}

/// Shown whenever the journal is locked: on a cold start, or after the app has
/// been in the background long enough (ADR-0006).
class UnlockPage extends StatefulWidget {
  const UnlockPage({
    super.key,
    required this.onUnlock,
    required this.onForgotten,
    this.onBiometric,
  });

  /// Returns false when the password does not open the journal.
  final Future<bool> Function(String password) onUnlock;

  final VoidCallback onForgotten;

  /// Offered only when a fingerprint was set up on this device. Null hides it —
  /// showing a button that cannot work would be worse than not offering it.
  final Future<bool> Function()? onBiometric;

  @override
  State<UnlockPage> createState() => _UnlockPageState();
}

class _UnlockPageState extends State<UnlockPage> {
  final _controller = TextEditingController();
  bool _busy = false;
  bool _wrong = false;

  @override
  void initState() {
    super.initState();
    // Clear the complaint as soon as they start correcting it, so the error is
    // about the last attempt rather than about what they are typing now.
    _controller.addListener(() {
      if (_wrong) setState(() => _wrong = false);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy || _controller.text.isEmpty) return;
    setState(() => _busy = true);
    final opened = await widget.onUnlock(_controller.text);
    if (!mounted) return;
    setState(() {
      _busy = false;
      _wrong = !opened;
    });
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
              Icon(Icons.lock_outline,
                  size: 40, color: theme.colorScheme.primary),
              const SizedBox(height: 16),
              Text(
                'Your journal is locked',
                style: theme.textTheme.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              TextField(
                key: UnlockKeys.field,
                controller: _controller,
                obscureText: true,
                autofocus: true,
                onSubmitted: (_) => _submit(),
                decoration: const InputDecoration(
                  labelText: 'Password',
                  border: OutlineInputBorder(),
                ),
              ),
              if (_wrong) ...[
                const SizedBox(height: 12),
                Text(
                  key: UnlockKeys.error,
                  'That password does not open this journal.',
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(color: theme.colorScheme.error),
                ),
              ],
              const SizedBox(height: 24),
              FilledButton(
                key: UnlockKeys.submit,
                onPressed: _busy ? null : _submit,
                child: _busy
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Unlock'),
              ),
              if (widget.onBiometric != null) ...[
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  key: UnlockKeys.biometric,
                  onPressed: _busy ? null : () => widget.onBiometric!(),
                  icon: const Icon(Icons.fingerprint),
                  label: const Text('Use your fingerprint'),
                ),
              ],
              const SizedBox(height: 8),
              TextButton(
                key: UnlockKeys.forgotten,
                onPressed: widget.onForgotten,
                child: const Text('I have forgotten my password'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
