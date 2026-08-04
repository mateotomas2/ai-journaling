import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/app.dart';
import 'package:reflekt/features/ai/journal_ai.dart';
import 'package:reflekt/features/ai/journal_tool.dart';
import 'package:reflekt/features/chat/day_chat.dart';
import 'package:reflekt/features/journal/journal_home_page.dart';
import 'package:reflekt/features/lock/set_password_page.dart';
import 'package:reflekt/features/settings/settings_page.dart';

import '_spec.dart';

/// SPEC — See what the AI is costing
///
/// The key is the person's own, and so is the bill. An app that spends someone
/// else's credit without ever saying how much is asking them to trust it about
/// the one thing they can check.
///
/// The number is in Settings rather than beside each answer, on purpose: a
/// journal that prices every thought is a journal you think less in.
///
/// What makes this worth its own spec is the arithmetic. Since the assistant
/// can act on the journal, **one message can be several billed requests** —
/// looking something up, then answering from what it found. A total that
/// counted only the last one would understate a conversation by however much
/// the looking-up cost.
///
/// Deliberately out of scope, so their absence is not mistaken for a gap:
///   * per-answer cost in the conversation itself
///   * a budget, a warning, or anything that stops you asking
///   * clearing the total
void main() {
  const password = 'a good password';
  const key = 'sk-or-not-a-real-key';

  runSpec(
    'See what the AI is costing',
    body: (spec) async {
      await spec.launch(
        ReflektApp(
          storageDirectory: spec.storageDirectory,
          ai: _AiThatCosts(),
        ),
      );

      await spec.given('a journal with a key saved and nothing spent',
          () async {
        await spec.type(find.byKey(SetPasswordKeys.field), password);
        await spec.tap(find.byKey(SetPasswordKeys.submit));
        await spec.eventually(find.byKey(JournalHomeKeys.settings));

        await spec.tap(find.byKey(JournalHomeKeys.settings));
        await spec.eventually(find.byKey(SettingsKeys.apiKeyField));
        await spec.type(find.byKey(SettingsKeys.apiKeyField), key);
        await spec.tap(find.byKey(SettingsKeys.save));
        await spec.eventually(find.text('Nothing spent yet.'));
      });

      await spec.when('one thing is asked, which takes a look first', () async {
        await spec.tester.pageBack();
        await spec.eventually(find.byKey(JournalHomeKeys.showChat));
        await spec.tap(find.byKey(JournalHomeKeys.showChat));
        await spec.eventually(find.byKey(ChatKeys.field));
        await spec.type(find.byKey(ChatKeys.field), 'How was my week?');
        await spec.tap(find.byKey(ChatKeys.send));
        await spec.eventually(
          find.text('Quiet, by the look of it.'),
          timeout: const Duration(seconds: 180),
        );
      });

      await spec.then('the whole of it was counted, not just the answer',
          () async {
        // Two requests for one message: the lookup and the answer. Counting
        // one would make the conversation look half as expensive as it was.
        await spec.tap(find.byKey(JournalHomeKeys.settings));
        await spec.eventually(find.byKey(SettingsKeys.spent));
        expect(find.textContaining('over 2 requests'), findsOneWidget);
      });
    },
  );
}

/// Answers after looking something up, and reports a cost for each request —
/// which is what a real provider does, once per billed call.
class _AiThatCosts implements JournalAi {
  @override
  Stream<AiEvent> ask({
    required String question,
    required List<String> entries,
    List<Exchange> earlier = const [],
    List<JournalTool> tools = const [],
  }) async* {
    await Future<void>.delayed(const Duration(milliseconds: 500));

    // The looking-up request.
    final look = tools.firstWhere((tool) => tool.name == 'read_notes');
    await look.run(const {});
    yield const AiSpent(cost: 0.003, tokens: 900);
    yield AiToolRan(look.name);

    await Future<void>.delayed(const Duration(milliseconds: 600));

    // The answering request.
    const reply = 'Quiet, by the look of it.';
    yield const AiText(reply);
    yield const AiSpent(cost: 0.002, tokens: 400);
    yield const AiFinished(Answer(reply));
  }
}
