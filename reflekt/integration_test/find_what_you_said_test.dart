import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/features/ai/journal_ai.dart';
import 'package:reflekt/features/ai/journal_tool.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/chat/day_chat.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';
import 'package:reflekt/features/journal/search_page.dart';

import '_spec.dart';

/// SPEC — Find something you said
///
/// Half of what someone puts into this journal now goes in through a
/// conversation. If meaning search only reached notes, that half would be
/// unfindable — and "I know I mentioned it" would be answered with nothing.
///
/// What the *assistant* said is deliberately never findable this way. Its
/// replies restate the entries they were built from, so indexing them would
/// rank the machine paraphrasing you above the thing you actually wrote
/// (ADR-0010). Text search still reaches them; meaning search does not.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * ranking, which no spec can meaningfully assert
///   * finding a note, which `find_by_meaning_test.dart` covers
void main() {
  const password = 'a good password';
  const said = 'I have been dragging myself out of bed all week.';
  const reply = 'That sounds like poor sleep rather than laziness.';
  const halfRemembered = 'trouble waking up';

  runSpec(
    'Find something you said',
    body: (spec) async {
      await spec.launch(
        ReflektApp(
          storageDirectory: spec.storageDirectory,
          ai: const _ScriptedAi(reply),
        ),
      );

      await spec.given('something said in a day\'s conversation', () async {
        await spec.type(find.byKey(SetPasswordKeys.field), password);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.addNote));

        await spec.tap(find.byKey(JournalHomeKeys.showChat));
        await spec.eventually(find.byKey(ChatKeys.field));
        await spec.type(find.byKey(ChatKeys.field), said);
        await spec.tap(find.byKey(ChatKeys.send));
        await spec.eventually(
          find.text(reply),
          timeout: const Duration(seconds: 180),
        );
      });

      await spec.when('it is looked for by what it meant', () async {
        await spec.tap(find.byKey(JournalHomeKeys.search));
        await spec.eventually(find.byKey(SearchKeys.field));
        await spec.tap(find.byKey(SearchKeys.byMeaning));
        await spec.type(find.byKey(SearchKeys.field), halfRemembered);
        await spec.tap(find.byKey(SearchKeys.submit));
      });

      await spec.then('it is found, though the words do not match', () async {
        await spec.eventually(
          find.text(said),
          timeout: const Duration(seconds: 180),
        );
      });

      await spec.and('what the assistant said is not among the results',
          () async {
        // The index holds the person's words only. A reply surfacing here
        // would be the machine's restatement competing with the original.
        expect(find.text(reply), findsNothing);
      });
    },
  );
}

class _ScriptedAi implements JournalAi {
  const _ScriptedAi(this.reply);

  final String reply;

  @override
  Stream<AiEvent> ask({
    required String question,
    required List<String> entries,
    List<Exchange> earlier = const [],
    List<JournalTool> tools = const [],
  }) async* {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    yield AiText(reply);
    yield AiFinished(Answer(reply));
  }
}
