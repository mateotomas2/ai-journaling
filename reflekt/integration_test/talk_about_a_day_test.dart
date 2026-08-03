import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/ai/journal_ai.dart';
import 'package:reflekt/features/chat/day_chat.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/journal/note_composer_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';
import 'package:reflekt/features/lock/unlock_page.dart';

import '_spec.dart';

/// SPEC — Talk about a day
///
/// Writing a note and talking about the day are two ways of putting something
/// into the same day, and the journal holds both. The conversation belongs to
/// the day it happened on, and it is still there tomorrow — a conversation
/// about your own life is not scratch state.
///
/// The AI is injected and answers from a script, so the spec is the same every
/// run. What this demonstrates is the app's behaviour around a conversation,
/// not that any particular model converses well.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * the assistant reading or writing notes, which arrives with tool calls
///   * deleting a message
///   * searching what was said
void main() {
  const password = 'a good password';
  const entry = 'Ran in the rain and felt better afterwards.';
  const said = 'Why did that help?';
  const openingOfReply = 'Because you got outside';
  const reply = 'Because you got outside and moved, by the sound of it.';

  runSpec(
    'Talk about a day',
    body: (spec) async {
      await spec.launch(
        ReflektApp(
          storageDirectory: spec.storageDirectory,
          ai: _ScriptedAi(openingOfReply, reply),
        ),
      );

      await spec.given('a day with something written on it', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), password);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.addNote));

        await spec.tap(find.byKey(JournalHomeKeys.addNote));
        await spec.type(find.byKey(NoteComposerKeys.field), entry);
        await spec.tap(find.byKey(NoteComposerKeys.save));
        await spec.eventually(find.text(entry));
      });

      await spec.when('the day is opened as a conversation', () async {
        await spec.tap(find.byKey(JournalHomeKeys.showChat));
      });

      await spec.then('nothing has been said on it yet', () async {
        await spec.eventually(find.byKey(ChatKeys.empty));
      });

      await spec.when('something is said', () async {
        await spec.type(find.byKey(ChatKeys.field), said);
        await spec.tap(find.byKey(ChatKeys.send));
      });

      await spec.then('it is answered as the answer is written', () async {
        await spec.eventually(find.byKey(ChatKeys.arriving));
        expect(find.textContaining(openingOfReply), findsOneWidget);
      });

      await spec.and('both halves of the conversation are there', () async {
        await spec.eventually(find.text(reply));
        expect(find.text(said), findsOneWidget);
      });

      await spec.when('the journal is locked and opened again', () async {
        await spec.restart(
          ReflektApp(
            storageDirectory: spec.storageDirectory,
            ai: _ScriptedAi(openingOfReply, reply),
          ),
        );
        await spec.type(find.byKey(UnlockKeys.field), password);
        await spec.tap(find.byKey(UnlockKeys.submit));
      });

      await spec.then('the conversation is still on that day', () async {
        // It also opens straight onto the chat: which surface someone last
        // used is how they journal, and being put back on the other one every
        // launch would be the app arguing with them.
        await spec.eventually(find.text(reply));
        expect(find.text(said), findsOneWidget);
      });
    },
  );
}

/// Replies from a script, in two parts with a pause between them.
///
/// A reply that finished in a single frame would make "answered as it is
/// written" impossible to assert and pointless to watch.
class _ScriptedAi implements JournalAi {
  const _ScriptedAi(this.opening, this.reply);

  final String opening;
  final String reply;

  @override
  Stream<AiEvent> ask({
    required String question,
    required List<String> entries,
    List<Exchange> earlier = const [],
  }) async* {
    await Future<void>.delayed(const Duration(milliseconds: 600));

    for (final word in opening.split(' ')) {
      yield AiText('$word ');
      await Future<void>.delayed(const Duration(milliseconds: 120));
    }

    await Future<void>.delayed(const Duration(milliseconds: 1600));

    for (final word in reply.substring(opening.length).trim().split(' ')) {
      yield AiText('$word ');
      await Future<void>.delayed(const Duration(milliseconds: 120));
    }

    yield AiFinished(Answer(reply));
  }
}
