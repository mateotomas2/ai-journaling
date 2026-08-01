import 'package:flutter/material.dart';

/// Keys the evidence test drives. Keep these stable — renaming one breaks the
/// happy-flow recording.
class NoteComposerKeys {
  static const field = Key('note_composer_field');
  static const save = Key('note_composer_save');
}

/// Full-screen composer. Pops with the written text, or `null` if dismissed.
class NoteComposerPage extends StatefulWidget {
  const NoteComposerPage({super.key});

  @override
  State<NoteComposerPage> createState() => _NoteComposerPageState();
}

class _NoteComposerPageState extends State<NoteComposerPage> {
  final _controller = TextEditingController();
  bool _canSave = false;

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
    Navigator.of(context).pop(text);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('New note'),
        actions: [
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
          expands: false,
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
