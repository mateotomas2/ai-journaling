import 'package:flutter/material.dart';

/// Keys the specs drive. Keep these stable — renaming one breaks a recording.
class NoteComposerKeys {
  static const field = Key('note_composer_field');
  static const save = Key('note_composer_save');
  static const delete = Key('note_composer_delete');
}

/// What the composer was closed with.
sealed class ComposerResult {
  const ComposerResult();
}

/// Keep this text — either as a new note or as a rewording of an existing one.
class NoteWritten extends ComposerResult {
  const NoteWritten(this.text);
  final String text;
}

/// Erase the note being edited (ADR-0007).
class NoteDeleted extends ComposerResult {
  const NoteDeleted();
}

/// Writes a new note, or reworks one that already exists.
class NoteComposerPage extends StatefulWidget {
  const NoteComposerPage({super.key, this.existingText});

  /// Null when writing something new. Deleting is only offered for a note that
  /// already exists — there is nothing to erase otherwise.
  final String? existingText;

  @override
  State<NoteComposerPage> createState() => _NoteComposerPageState();
}

class _NoteComposerPageState extends State<NoteComposerPage> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.existingText ?? '');
  late bool _canSave = _controller.text.trim().isNotEmpty;

  bool get _isExisting => widget.existingText != null;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      final canSave = _controller.text.trim().isNotEmpty;
      if (canSave != _canSave) setState(() => _canSave = canSave);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _save() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    Navigator.of(context).pop(NoteWritten(text));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isExisting ? 'Note' : 'New note'),
        actions: [
          if (_isExisting)
            IconButton(
              key: NoteComposerKeys.delete,
              icon: const Icon(Icons.delete_outline),
              tooltip: 'Delete this note',
              onPressed: () =>
                  Navigator.of(context).pop(const NoteDeleted()),
            ),
          TextButton(
            key: NoteComposerKeys.save,
            onPressed: _canSave ? _save : null,
            child: const Text('Save'),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: TextField(
          key: NoteComposerKeys.field,
          controller: _controller,
          autofocus: true,
          maxLines: null,
          keyboardType: TextInputType.multiline,
          decoration: const InputDecoration(
            border: InputBorder.none,
            hintText: "What's on your mind?",
          ),
        ),
      ),
    );
  }
}
