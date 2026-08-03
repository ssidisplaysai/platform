# 02 Deterministic Rendering Certification

Condition C1 from GNP-1001A:
- Template rendering injects a random renderId into the rendered variable payload.
- Identical input does not always produce identical rendered output.

Certification review:
- `TemplateRenderer` now derives a deterministic `renderIdentity` from stable render inputs.
- The render output no longer includes runtime random UUID generation.
- Required variables are collected from the template body, subject, and title, then resolved deterministically.
- Identical inputs produce identical output objects and identical serialized content in the focused test.

Evidence reviewed:
- `src/platform/notifications/services/TemplateRenderer.ts`
- `tests/notifications/notification-foundation.test.ts`

Conclusion:
- C1 is CLOSED.
