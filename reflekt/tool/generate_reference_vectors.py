"""Generates the fixtures that prove the Dart embedder matches a known-good one.

Run from `reflekt/`:

    python3 -m venv .venv && .venv/bin/pip install onnxruntime numpy tokenizers
    .venv/bin/python tool/generate_reference_vectors.py

Why this exists: a wrong WordPiece tokenizer still produces vectors. They are
plausible, they rank confidently, and they mean nothing — no crash, no failing
assertion, just search that quietly returns the wrong entries. Ranking checks
cannot catch it, because almost any embedding better than random gets a single
hand-picked example right.

So the Dart implementation is checked against vectors produced by the reference
tokenizer through the *same* ONNX file the app ships. A mismatch therefore
isolates the tokenizer rather than the model.
"""

import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

HERE = Path(__file__).resolve().parent.parent
MODEL = HERE / "assets/model/model.onnx"
TOKENIZER = HERE / "assets/model/tokenizer.json"
OUT = HERE / "test/fixtures/reference_vectors.json"

# Chosen to exercise the parts of WordPiece that are easy to get wrong:
# subword splitting, casing, punctuation, and an unknown word.
PHRASES = [
    "hello world",
    "Ran in the rain and felt better afterwards.",
    "The sourdough finally worked.",
    "unbelievably discombobulated",
    "Walked the long way home, stopped at the bridge.",
    "café",
]


def main() -> None:
    tokenizer = Tokenizer.from_file(str(TOKENIZER))
    # The published config pads every sequence to 128. Padding is not part of
    # tokenisation — mean pooling masks it out and the vector is the same
    # either way — so the fixtures record the real tokens and nothing else.
    # Leaving it on would make the Dart implementation look wrong for a reason
    # that has nothing to do with it.
    tokenizer.no_padding()
    tokenizer.no_truncation()
    session = ort.InferenceSession(str(MODEL))

    fixtures = []
    for phrase in PHRASES:
        encoded = tokenizer.encode(phrase)
        ids = np.array([encoded.ids], dtype=np.int64)
        mask = np.array([encoded.attention_mask], dtype=np.int64)
        types = np.zeros_like(ids)

        outputs = session.run(
            None,
            {
                "input_ids": ids,
                "attention_mask": mask,
                "token_type_ids": types,
            },
        )

        # Mean pooling over real tokens, then L2 normalise — what
        # sentence-transformers does for this model.
        hidden = outputs[0][0]
        weights = encoded.attention_mask
        pooled = (hidden * np.array(weights)[:, None]).sum(0) / max(sum(weights), 1)
        pooled = pooled / np.linalg.norm(pooled)

        fixtures.append(
            {
                "phrase": phrase,
                "tokens": encoded.ids,
                "vector": [round(float(v), 6) for v in pooled],
            }
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(fixtures, indent=2) + "\n")
    print(f"wrote {len(fixtures)} fixtures to {OUT.relative_to(HERE)}")


if __name__ == "__main__":
    main()
