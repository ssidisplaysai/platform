# 10 Certification Evidence

Primary engineering evidence:
- src/platform/organization/contracts/index.ts
- src/platform/organization/services/index.ts
- src/platform/organization/persistence/FileOrganizationStore.ts
- src/platform/organization/integration/index.ts
- src/platform/organization/runtime/index.ts
- tests/organization/geo-1001-organization-foundation.test.ts

Boundary evidence:
- Explicit dependency contracts for identity, authorization, messaging, workflow, scheduling, notifications, and ai.
- No ownership implementation for these external capabilities.
