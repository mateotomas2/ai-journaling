import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:reflekt/features/memory/word_piece.dart';

/// The Dart tokenizer against the reference one.
///
/// This is the only check that can catch a wrong tokenizer. A wrong one still
/// produces a vector — 384 numbers, plausible, confidently ranked — that means
/// something other than the text. Nothing crashes and no ranking assertion
/// fails, because almost any embedding better than random gets a single
/// hand-picked example right.
///
/// Fixtures come from `tool/generate_reference_vectors.py`, which uses the
/// HuggingFace tokenizer and the same ONNX file the app ships. Comparing token
/// ids rather than vectors makes a failure say *where* it went wrong.
void main() {
  late WordPiece tokenizer;
  late List<dynamic> fixtures;

  setUpAll(() {
    final vocabulary = <String, int>{};
    final lines = File('assets/model/vocab.txt').readAsLinesSync();
    for (var i = 0; i < lines.length; i++) {
      vocabulary[lines[i]] = i;
    }
    tokenizer = WordPiece(vocabulary);

    fixtures = jsonDecode(
      File('test/fixtures/reference_vectors.json').readAsStringSync(),
    ) as List<dynamic>;
  });

  test('the vocabulary loaded and has the special tokens', () {
    expect(tokenizer.vocabulary, hasLength(greaterThan(30000)));
    expect(tokenizer.clsId, isNot(tokenizer.sepId));
  });

  test('every reference phrase tokenises identically', () {
    for (final fixture in fixtures) {
      final phrase = fixture['phrase'] as String;
      final expected = (fixture['tokens'] as List).cast<int>();
      final actual = tokenizer.encode(phrase).ids;

      expect(
        actual,
        expected,
        reason: 'tokens differ for "$phrase".\n'
            'A mismatch here means every vector this produces is subtly wrong, '
            'in a way that search results would not reveal.',
      );
    }
  });

  test('punctuation is split off rather than glued to a word', () {
    // "home." must not be one unknown token — the model has never seen it.
    final ids = tokenizer.encode('home.').ids;
    expect(ids, isNot(contains(tokenizer.unkId)));
  });

  test('a long unknown word becomes subwords, not [UNK]', () {
    final ids = tokenizer.encode('discombobulated').ids;
    expect(ids.where((id) => id == tokenizer.unkId), isEmpty);
    expect(ids.length, greaterThan(3));
  });

  test('encoding is wrapped in [CLS] and [SEP]', () {
    final ids = tokenizer.encode('hello').ids;
    expect(ids.first, tokenizer.clsId);
    expect(ids.last, tokenizer.sepId);
  });

  test('long text is truncated to fit the model', () {
    final ids = tokenizer.encode('word ' * 500, maxTokens: 64).ids;
    expect(ids, hasLength(lessThanOrEqualTo(64)));
    expect(ids.last, tokenizer.sepId, reason: 'truncation dropped [SEP]');
  });
}
