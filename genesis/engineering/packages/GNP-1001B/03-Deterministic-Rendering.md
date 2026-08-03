# 03 Deterministic Rendering

Strategy:
1. Remove random render metadata from the render output.
2. Derive a stable `renderIdentity` from the template identity, version, channel, subject, title, body, and resolved variables.
3. Keep the render output fully reproducible for identical inputs.
4. Preserve provider-neutral interpolation behavior.

Behavior:
1. Same template + same variables + same metadata + same locale + same tenant + same workspace produce byte-for-byte equivalent output.
2. Missing variables still fail fast.
3. The render identity is deterministic and derived from the rendered content model, not randomly generated at runtime.
