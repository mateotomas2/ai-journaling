---
status: accepted
---

# On-device embeddings via TFLite/ONNX, not a cloud embeddings API

The PWA generates 384-dim embeddings locally in-browser via transformers.js (`all-MiniLM-L6-v2`) for memory search, so journal content never leaves the device except for chat/summary calls to OpenRouter. Flutter has no equivalent in-process JS ML runtime, so we're porting the same MiniLM model to `.tflite` / `.onnx` and running it on-device via `tflite_flutter` / `onnxruntime_flutter`, rather than calling a cloud embeddings endpoint. Sending journal text to a cloud API just to compute vectors would silently break the app's core privacy claim, for a data path that currently never leaves the device.
