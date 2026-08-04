import '../../db/journal_database.dart';

/// What the AI has cost so far.
///
/// Kept in the encrypted journal beside the API key. How much someone has
/// spent thinking about their own life is not something to leave in shared
/// preferences for anything on the device to read.
class Spend {
  const Spend({required this.dollars, required this.answers, required this.tokens});

  static const _dollarsSetting = 'openrouter.spent_dollars';
  static const _answersSetting = 'openrouter.billed_requests';
  static const _tokensSetting = 'openrouter.tokens';

  /// Running total in US dollars.
  final double dollars;

  /// How many billed requests it took. Deliberately not "questions asked":
  /// since tools, one message can be several requests, and pretending
  /// otherwise would make the per-answer cost look smaller than it is.
  final int answers;

  final int tokens;

  static const none = Spend(dollars: 0, answers: 0, tokens: 0);

  static Future<Spend> read(JournalDatabase database) async {
    final dollars = await database.setting(_dollarsSetting);
    final answers = await database.setting(_answersSetting);
    final tokens = await database.setting(_tokensSetting);

    return Spend(
      dollars: double.tryParse(dollars ?? '') ?? 0,
      answers: int.tryParse(answers ?? '') ?? 0,
      tokens: int.tryParse(tokens ?? '') ?? 0,
    );
  }

  /// Adds one billed request to the total.
  ///
  /// Read-then-write rather than an increment in SQL, because the settings
  /// table stores text. Requests are answered one at a time, so there is no
  /// race worth defending against here.
  static Future<void> record(
    JournalDatabase database, {
    required double cost,
    required int tokens,
  }) async {
    final now = await read(database);
    await database.putSetting(_dollarsSetting, '${now.dollars + cost}');
    await database.putSetting(_answersSetting, '${now.answers + 1}');
    await database.putSetting(_tokensSetting, '${now.tokens + tokens}');
  }

  /// How it reads on screen.
  ///
  /// Fractions of a cent are shown rather than rounded away: a journal that
  /// reports "$0.00" after a dozen questions looks broken, and the whole point
  /// is that the number is true.
  String get inWords {
    if (answers == 0) return 'Nothing spent yet.';
    if (dollars < 0.01) {
      return 'About ${(dollars * 100).toStringAsFixed(2)}¢ so far, '
          'over $answers ${answers == 1 ? 'request' : 'requests'}.';
    }
    return '\$${dollars.toStringAsFixed(2)} so far, '
        'over $answers ${answers == 1 ? 'request' : 'requests'}.';
  }
}
