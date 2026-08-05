import 'package:flutter/material.dart';

import 'note_category.dart';

/// Keys the specs drive. Keep these stable — renaming one breaks a recording.
class NoteComposerKeys {
  static const field = Key('note_composer_field');
  static const save = Key('note_composer_save');
  static const delete = Key('note_composer_delete');

  /// One per category, so a spec can name the one it means.
  static Key categoryOf(String id) => Key('note_composer_category_$id');
  static const addCategory = Key('note_composer_add_category');
  static const newCategory = Key('note_composer_new_category');
  static const saveCategory = Key('note_composer_save_category');
}

/// What the composer was closed with.
sealed class ComposerResult {
  const ComposerResult();
}

/// Keep this text — either as a new note or as a rewording of an existing one.
class NoteWritten extends ComposerResult {
  const NoteWritten(this.text, this.category);
  final String text;

  /// Empty when the writer did not name one, which is allowed.
  final String category;
}

/// Erase the note being edited (ADR-0007).
class NoteDeleted extends ComposerResult {
  const NoteDeleted();
}

/// Writes a new note, or reworks one that already exists.
class NoteComposerPage extends StatefulWidget {
  const NoteComposerPage({
    super.key,
    this.existingText,
    this.existingCategory = '',
    this.known = const [],
  });

  /// Null when writing something new. Deleting is only offered for a note that
  /// already exists — there is nothing to erase otherwise.
  final String? existingText;
  final String existingCategory;

  /// What this journal already calls things, most-used first. Offered before
  /// the blank field so reaching for an existing word is the easy path
  /// (ADR-0012).
  final List<String> known;

  @override
  State<NoteComposerPage> createState() => _NoteComposerPageState();
}

class _NoteComposerPageState extends State<NoteComposerPage> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.existingText ?? '');
  late bool _canSave = _controller.text.trim().isNotEmpty;
  late String _category = widget.existingCategory;

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
    Navigator.of(context).pop(NoteWritten(text, _category));
  }

  /// What to offer: the journal's own words first, then the starting few for a
  /// journal that has none, plus whatever this note already says.
  List<String> get _offered {
    final offered = [
      ...widget.known,
      if (widget.known.isEmpty) ...NoteCategories.suggestions,
    ];
    if (_category.isNotEmpty && !offered.contains(_category)) {
      offered.insert(0, _category);
    }
    return offered;
  }

  /// Somewhere to type a category this journal has never used.
  Future<void> _nameOne() async {
    final typed = TextEditingController();
    final named = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('What is this about?'),
        content: TextField(
          key: NoteComposerKeys.newCategory,
          controller: typed,
          autofocus: true,
          textCapitalization: TextCapitalization.none,
          decoration: const InputDecoration(hintText: 'work, mum, running…'),
          onSubmitted: (value) => Navigator.of(context).pop(value),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            key: NoteComposerKeys.saveCategory,
            onPressed: () => Navigator.of(context).pop(typed.text),
            child: const Text('Use it'),
          ),
        ],
      ),
    );
    typed.dispose();

    final category = NoteCategories.store(named ?? '');
    if (category.isEmpty || !mounted) return;
    setState(() => _category = category);
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
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Wrap(
              spacing: 8,
              children: [
                for (final category in _offered)
                  ChoiceChip(
                    key: NoteComposerKeys.categoryOf(category),
                    label: Text(NoteCategories.label(category)),
                    selected: _category == category,
                    // Tapping the chosen one again clears it: picking a
                    // category should never be a one-way door.
                    onSelected: (selected) => setState(
                      () => _category = selected ? category : '',
                    ),
                  ),
                ActionChip(
                  key: NoteComposerKeys.addCategory,
                  avatar: const Icon(Icons.add, size: 18),
                  label: const Text('Something else'),
                  onPressed: _nameOne,
                ),
              ],
            ),
          ),
          Expanded(
            child: Padding(
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
          ),
        ],
      ),
    );
  }
}
