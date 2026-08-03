# Native libraries added by hand

## `x86_64/libonnxruntime.so`

The `onnxruntime` Flutter plugin ships `jniLibs` for `armeabi-v7a` and
`arm64-v8a` only. Real phones are covered; the **x86_64 emulator is not**, and
without this the app installs happily and then dies the first time anything
touches the model:

```
Failed to load dynamic library 'libonnxruntime.so':
dlopen failed: library "libonnxruntime.so" not found
```

That would mean semantic search could never be recorded as evidence, because
recordings run on an emulator (ADR-0005).

This file is the `x86_64` build from Microsoft's official
`onnxruntime-android` AAR at **1.15.1** — the same version the plugin bundles
for the arm ABIs, confirmed by reading the version string out of the shipped
`.so`. Matching versions matters: the Dart bindings are compiled against a
particular ABI, and a different runtime version can fail in ways that look like
model errors.

Retrieved with:

```bash
curl -sSLO https://repo1.maven.org/maven2/com/microsoft/onnxruntime/onnxruntime-android/1.15.1/onnxruntime-android-1.15.1.aar
unzip -o onnxruntime-android-1.15.1.aar 'jni/x86_64/libonnxruntime.so'
```

If the plugin is upgraded, check the arm `.so` version and replace this to
match, or delete it if the plugin starts shipping `x86_64` itself.
