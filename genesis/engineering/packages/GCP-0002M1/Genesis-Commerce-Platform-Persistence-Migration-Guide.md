# Genesis Commerce Platform Persistence Migration Guide

## Purpose
Document migration from fixture-only in-memory repositories to durable repository state while preserving foundation behavior.

## Migration Steps Completed
1. Added durable persistence runtime (foundation-persistence.ts).
2. Introduced per-repository state DTOs and persistence namespaces.
3. Replaced fixture-only initialization with loadPersistedState(...).
4. Added persistCurrentState() commit after successful writes.
5. Added reset...ForTests() reset flow backed by resetPersistedState(...).
6. Added inventory rollback snapshots for multi-step operations.

## Operational Notes
1. Persistence root default:
- .gcp-foundation-data under repository root.

2. Test-mode isolation:
- .gcp-foundation-data-test-<JEST_WORKER_ID>.

3. Seed behavior:
- First load seeds from fixtures and writes revision 0.

## Backward Compatibility
1. API request/response contracts unchanged.
2. Validation behaviors preserved.
3. Existing route authorization and scope behaviors preserved.

## Future Migration Path
1. Replace file-backed adapter with approved database adapter.
2. Keep repository state DTO and commit/rollback semantics stable.
3. Add explicit unit-of-work abstraction when cross-repository aggregate transactions are introduced.
