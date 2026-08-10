# 04 Manufacturing Manifest Validation

Structural validation is Manufacturing-owned and explicit.

Validated fields:
- schemaVersion
- platformId
- runtimeId
- tenantIds
- writtenAt
- snapshotVersion
- runtimeState
- required tenant partition collections
- required idempotency collections

Malformed JSON, invalid manifest shape, missing tenant partition files, and tenant payload mismatches fail closed.
