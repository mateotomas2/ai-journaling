import 'dart:math';
import 'dart:typed_data';

import 'package:flutter/services.dart';
import 'package:onnxruntime/onnxruntime.dart';

import 'word_piece.dart';

/// Turns text into a vector that can be compared for meaning.
///
/// Runs entirely on the device (ADR-0003). Journal text is not sent anywhere to
/// be indexed — that is the whole point of doing this the hard way rather than
/// calling an embeddings API.
///
/// The tokenizer is the fragile part and is pinned to a reference
/// implementation by `test/word_piece_test.dart`; a wrong one produces vectors
/// that are plausible, confidently ranked and meaningless.
class JournalEmbedder {
  JournalEmbedder._(this._session, this._tokenizer);

  final OrtSession _session;
  final WordPiece _tokenizer;

  /// all-MiniLM-L6-v2 produces 384 numbers per piece of text.
  static const dimensions = 384;

  static JournalEmbedder? _instance;

  /// Loads the model and vocabulary once. Reloading a 22MB model per note would
  /// make writing feel slow for no reason.
  static Future<JournalEmbedder> load() async {
    if (_instance != null) return _instance!;

    OrtEnv.instance.init();

    final model = await rootBundle.load('assets/model/model.onnx');
    final session = OrtSession.fromBuffer(
      model.buffer.asUint8List(),
      OrtSessionOptions(),
    );

    final vocabularyFile =
        await rootBundle.loadString('assets/model/vocab.txt');
    final vocabulary = <String, int>{};
    final lines = vocabularyFile.split('\n');
    for (var i = 0; i < lines.length; i++) {
      final token = lines[i].replaceAll('\r', '');
      if (token.isNotEmpty) vocabulary[token] = i;
    }

    return _instance = JournalEmbedder._(session, WordPiece(vocabulary));
  }

  /// The vector for [text], normalised so similarity is a dot product.
  Future<Float32List> embed(String text) async {
    final encoded = _tokenizer.encode(text);
    final length = encoded.ids.length;

    final ids = OrtValueTensor.createTensorWithDataList(
      Int64List.fromList(encoded.ids),
      [1, length],
    );
    final mask = OrtValueTensor.createTensorWithDataList(
      Int64List.fromList(encoded.attentionMask),
      [1, length],
    );
    final types = OrtValueTensor.createTensorWithDataList(
      Int64List(length),
      [1, length],
    );

    try {
      final outputs = _session.run(
        OrtRunOptions(),
        {'input_ids': ids, 'attention_mask': mask, 'token_type_ids': types},
      );

      // [batch][token][dimension]
      final hidden = (outputs.first?.value as List).first as List;

      // Mean pooling across real tokens, then L2 normalisation — what this
      // model expects. Taking [CLS] alone instead is a common shortcut and
      // gives noticeably worse results for sentence similarity.
      final pooled = Float32List(dimensions);
      for (final token in hidden) {
        final values = token as List;
        for (var d = 0; d < dimensions; d++) {
          pooled[d] += (values[d] as num).toDouble();
        }
      }

      var magnitude = 0.0;
      for (var d = 0; d < dimensions; d++) {
        pooled[d] /= hidden.length;
        magnitude += pooled[d] * pooled[d];
      }
      magnitude = sqrt(magnitude);
      if (magnitude > 0) {
        for (var d = 0; d < dimensions; d++) {
          pooled[d] /= magnitude;
        }
      }

      for (final output in outputs) {
        output?.release();
      }
      return pooled;
    } finally {
      ids.release();
      mask.release();
      types.release();
    }
  }

  /// Closeness of two normalised vectors: 1 is identical, 0 unrelated.
  static double similarity(Float32List a, Float32List b) {
    var total = 0.0;
    for (var i = 0; i < a.length && i < b.length; i++) {
      total += a[i] * b[i];
    }
    return total;
  }

  /// Vectors are stored as raw bytes rather than JSON numbers: 384 doubles as
  /// text is several kilobytes per note, and the journal is encrypted, so every
  /// byte is paid for twice.
  static Uint8List toBytes(Float32List vector) =>
      vector.buffer.asUint8List(vector.offsetInBytes, vector.lengthInBytes);

  static Float32List fromBytes(Uint8List bytes) =>
      Float32List.view(Uint8List.fromList(bytes).buffer);
}
