# 02 Deterministic Rendering Verification

Condition C1:
- Deterministic template rendering.

Verification review:
- `TemplateRenderer` does not generate runtime random identity data for the render result.
- The render identity is derived deterministically from template identity, version, channel, subject, title, body, and sorted resolved variables.
- `RenderedNotification` includes `renderIdentity` as part of the stable output contract.
- Template metadata, locale, tenant, and workspace remain part of the surrounding notification model and are preserved where required by the engine and tests.

Direct evidence:
- `src/platform/notifications/services/TemplateRenderer.ts`
- `src/platform/notifications/contracts/index.ts`
- `tests/notifications/notification-foundation.test.ts`

Verification result:
- Identical inputs produce byte-for-byte identical rendered output.
- Repeatability is covered by direct tests.
- C1 is CLOSED.
