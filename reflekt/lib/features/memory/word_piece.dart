/// WordPiece tokenisation, as BERT-family models expect it.
///
/// This is the part of on-device embedding most likely to be subtly wrong, and
/// being wrong here does not announce itself: the model still returns a vector,
/// it is still 384 numbers, it still ranks confidently — it just means
/// something other than the text. `test/word_piece_test.dart` checks the token
/// ids against fixtures produced by the reference tokenizer, because comparing
/// search results would not catch it.
class WordPiece {
  WordPiece(this.vocabulary)
      : clsId = vocabulary['[CLS]']!,
        sepId = vocabulary['[SEP]']!,
        unkId = vocabulary['[UNK]']!,
        padId = vocabulary['[PAD]']!;

  /// Token to id. Built from the model's `vocab.txt`, in file order.
  final Map<String, int> vocabulary;

  final int clsId;
  final int sepId;
  final int unkId;
  final int padId;

  /// Longest word that will be split at all. Beyond this the reference
  /// implementation gives up and emits `[UNK]` rather than trying.
  static const _maxWordLength = 100;

  /// This model is uncased, so text is lowercased and accents are stripped
  /// before matching — "café" and "cafe" must reach the same tokens or the two
  /// embed differently, which a reader would find inexplicable.
  static String normalise(String text) {
    const accents = {
      'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a', 'å': 'a',
      'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
      'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
      'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o',
      'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
      'ñ': 'n', 'ç': 'c',
    };
    final lowered = text.toLowerCase();
    final buffer = StringBuffer();
    for (final rune in lowered.runes) {
      final character = String.fromCharCode(rune);
      buffer.write(accents[character] ?? character);
    }
    return buffer.toString();
  }

  /// Splits on whitespace, and separates punctuation into its own tokens —
  /// "home." is "home" and "." rather than one unknown word.
  static List<String> splitWords(String text) {
    final words = <String>[];
    final current = StringBuffer();

    void flush() {
      if (current.isEmpty) return;
      words.add(current.toString());
      current.clear();
    }

    for (final rune in text.runes) {
      final character = String.fromCharCode(rune);
      if (character.trim().isEmpty) {
        flush();
      } else if (_isPunctuation(character)) {
        flush();
        words.add(character);
      } else {
        current.write(character);
      }
    }
    flush();
    return words;
  }

  static bool _isPunctuation(String character) {
    final code = character.codeUnitAt(0);
    return (code >= 33 && code <= 47) ||
        (code >= 58 && code <= 64) ||
        (code >= 91 && code <= 96) ||
        (code >= 123 && code <= 126);
  }

  /// Greedy longest-match-first, the algorithm BERT's tokenizer uses.
  ///
  /// Continuations are prefixed `##`, so "discombobulated" becomes something
  /// like "disco", "##mb", "##ob"… A word that cannot be covered emits `[UNK]`
  /// as a whole — partially tokenising it would silently change its meaning.
  List<int> tokenizeWord(String word) {
    if (word.length > _maxWordLength) return [unkId];

    final tokens = <int>[];
    var start = 0;

    while (start < word.length) {
      var end = word.length;
      int? matched;

      while (start < end) {
        final piece = start == 0
            ? word.substring(start, end)
            : '##${word.substring(start, end)}';
        final id = vocabulary[piece];
        if (id != null) {
          matched = id;
          break;
        }
        end--;
      }

      if (matched == null) return [unkId];
      tokens.add(matched);
      start = end;
    }

    return tokens;
  }

  /// Encodes [text] for the model, with `[CLS]` and `[SEP]` around it.
  ///
  /// Truncated to [maxTokens] including those two, because the model has a
  /// fixed input length and silently producing a longer sequence would fail
  /// deep inside the runtime.
  Encoded encode(String text, {int maxTokens = 256}) {
    final ids = <int>[clsId];

    for (final word in splitWords(normalise(text))) {
      for (final id in tokenizeWord(word)) {
        if (ids.length >= maxTokens - 1) break;
        ids.add(id);
      }
      if (ids.length >= maxTokens - 1) break;
    }

    ids.add(sepId);
    return Encoded(ids, List.filled(ids.length, 1));
  }
}

/// Token ids and which of them are real (all of them, until padding is added).
class Encoded {
  const Encoded(this.ids, this.attentionMask);
  final List<int> ids;
  final List<int> attentionMask;
}
