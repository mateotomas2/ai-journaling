import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart' show Value;
import 'package:path/path.dart' as p;

import '../../db/journal_database.dart';
import 'settings_page.dart' show openRouterKeySetting;

/// The journal as a file someone can keep (ADR-0011).
///
/// Plaintext JSON, deliberately: an export only this app can read is a backup,
/// and backup is a different feature. The cost is that the file is readable by
/// anything that opens it, which is said plainly where the button lives rather
/// than buried here.
class JournalArchive {
  const JournalArchive._();

  /// Bumped if the shape ever changes, so a reader can refuse a file it does
  /// not understand rather than importing half of it.
  static const version = 1;

  static const fileName = 'reflekt-journal.json';

  /// Writes everything worth keeping into [directory], and says where.
  static Future<File> write(
    JournalDatabase database,
    String directory,
  ) async {
    final notes = await database.allLivingNotes();
    final messages = await database.allLivingMessages();
    final settings = await database.allSettings();

    final archive = {
      'reflekt': version,
      'written': DateTime.now().toIso8601String(),
      'notes': [
        for (final note in notes)
          {
            'id': note.id,
            'day': note.dayId,
            'content': note.content,
            'category': note.category,
            'written': note.createdAt,
          },
      ],
      'messages': [
        for (final message in messages)
          {
            'id': message.id,
            'day': message.dayId,
            'role': message.role,
            'content': message.content,
            'said': message.createdAt,
          },
      ],
      'settings': {
        for (final setting in settings)
          // Never the API key. It is a live credential that can spend the
          // owner's money, and a plaintext file carrying one is a different
          // and much worse artefact than one carrying someone's notes.
          if (setting.name != openRouterKeySetting) setting.name: setting.value,
      },
    };

    final file = File(p.join(directory, fileName));
    await file.writeAsString(
      // Indented so it is readable by the person who exported it. That is the
      // whole reason this is JSON rather than a blob.
      const JsonEncoder.withIndent('  ').convert(archive),
    );
    return file;
  }

  /// Reads an archive back in, and says how much arrived.
  ///
  /// Merges rather than replaces. An import that wiped what is already here
  /// would make restoring one lost note cost every note written since.
  static Future<int> read(JournalDatabase database, File file) async {
    final body = jsonDecode(await file.readAsString());
    if (body is! Map<String, dynamic>) {
      throw const ArchiveUnreadable('That file is not a Reflekt journal.');
    }
    if (body['reflekt'] != version) {
      throw const ArchiveUnreadable(
        'That file was written by a different version of Reflekt.',
      );
    }

    var restored = 0;

    for (final entry in body['notes'] as List? ?? const []) {
      if (entry is! Map<String, dynamic>) continue;
      await database.putNote(
        NotesCompanion(
          id: Value(entry['id'] as String),
          dayId: Value(entry['day'] as String),
          content: Value(entry['content'] as String),
          category: Value(entry['category'] as String? ?? ''),
          createdAt: Value(entry['written'] as int),
          // Anything in the file is something that existed when it was
          // written, so importing it un-deletes whatever was erased since.
          // That is the person restoring their own writing.
          deletedAt: const Value(0),
        ),
      );
      restored++;
    }

    for (final entry in body['messages'] as List? ?? const []) {
      if (entry is! Map<String, dynamic>) continue;
      await database.putMessage(
        MessagesCompanion(
          id: Value(entry['id'] as String),
          dayId: Value(entry['day'] as String),
          role: Value(entry['role'] as String),
          content: Value(entry['content'] as String),
          createdAt: Value(entry['said'] as int),
          deletedAt: const Value(0),
        ),
      );
      restored++;
    }

    final settings = body['settings'];
    if (settings is Map<String, dynamic>) {
      for (final entry in settings.entries) {
        // Belt and braces: a hand-edited file could carry a key, and importing
        // one would put a credential somewhere it was never meant to be.
        if (entry.key == openRouterKeySetting) continue;
        await database.putSetting(entry.key, '${entry.value}');
      }
    }

    return restored;
  }
}

/// Thrown when a file is not something this app can import. Carries a sentence
/// fit to show someone.
class ArchiveUnreadable implements Exception {
  const ArchiveUnreadable(this.message);
  final String message;
  @override
  String toString() => message;
}
