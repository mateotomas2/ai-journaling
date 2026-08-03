import 'package:flutter/material.dart';

/// Keys the specs drive. Keep these stable — renaming one breaks a recording.
class ChangePasswordKeys {
  static const current = Key('change_password_current');
  static const replacement = Key('change_password_new');
  static const submit = Key('change_password_submit');
  static const wrong = Key('change_password_wrong');
}

/// Changing the password the journal is encrypted with.
///
/// Its own screen: this rewrites every page of the database, and burying it in
/// a settings list next to appearance toggles would misrepresent how much it
/// does.
class ChangePasswordPage extends StatefulWidget {
  const ChangePasswordPage({super.key, required this.onChange});

  /// Returns false when the current password is wrong, in which case nothing
  /// was touched.
  final Future<bool> Function(String current, String replacement) onChange;

  @override
  State<ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends State<ChangePasswordPage> {
  final _current = TextEditingController();
  final _replacement = TextEditingController();
  bool _busy = false;
  bool _wrong = false;

  @override
  void initState() {
    super.initState();
    // Clear the complaint as they correct it: the error is about the last
    // attempt, not about what they are typing now.
    _current.addListener(() {
      if (_wrong) setState(() => _wrong = false);
    });
  }

  @override
  void dispose() {
    _current.dispose();
    _replacement.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      _current.text.isNotEmpty && _replacement.text.trim().length >= 8;

  Future<void> _submit() async {
    if (_busy || !_canSubmit) return;
    setState(() => _busy = true);

    final changed = await widget.onChange(_current.text, _replacement.text);
    if (!mounted) return;

    if (changed) {
      Navigator.of(context).pop();
      return;
    }
    setState(() {
      _busy = false;
      _wrong = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Change password')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(
            'Your journal is re-encrypted with the new password. Everything you '
            'have written stays exactly where it is.',
            style: theme.textTheme.bodyMedium,
          ),
          const SizedBox(height: 24),
          TextField(
            key: ChangePasswordKeys.current,
            controller: _current,
            obscureText: true,
            autofocus: true,
            decoration: const InputDecoration(
              labelText: 'Current password',
              border: OutlineInputBorder(),
            ),
          ),
          if (_wrong) ...[
            const SizedBox(height: 8),
            Text(
              key: ChangePasswordKeys.wrong,
              'That is not the current password. Nothing has been changed.',
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: theme.colorScheme.error),
            ),
          ],
          const SizedBox(height: 16),
          TextField(
            key: ChangePasswordKeys.replacement,
            controller: _replacement,
            obscureText: true,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'New password',
              helperText: 'At least 8 characters',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.warning_amber_rounded,
                  size: 18, color: theme.colorScheme.error),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'The old password stops working. There is still no way to '
                  'recover a forgotten one.',
                  style: theme.textTheme.bodySmall,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          FilledButton(
            key: ChangePasswordKeys.submit,
            onPressed: _canSubmit && !_busy ? _submit : null,
            child: _busy
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Change it'),
          ),
        ],
      ),
    );
  }
}
