# Genesis Commerce Platform Persistence Architecture

## Architecture Summary
The foundation layer now uses a durable repository model backed by revisioned JSON persistence envelopes stored per repository namespace.

## Components
1. Persistence runtime
- File: src/modules/foundation/foundation-persistence.ts
- Responsibilities:
  - Load repository state from disk.
  - Persist repository state with revision token checks.
  - Emit conflict and serialization errors.
  - Reset state to deterministic fixture seed.

2. Repository durable adapters
- Files:
  - src/modules/foundation/site-repository.ts
  - src/modules/foundation/product-repository.ts
  - src/modules/foundation/integration-profile-repository.ts
  - src/modules/foundation/customer-repository.ts
  - src/modules/foundation/inventory-repository.ts
- Responsibilities:
  - Maintain in-memory working map stores for bounded runtime behavior.
  - Load initial state from durable envelope.
  - Persist state after successful mutation.

## Persistence Envelope
Each namespace file stores:
1. schemaVersion
2. revision
3. updatedAt
4. data (repository state)

## Swappability Contract
Swappability is preserved by repository-local state serialization boundaries:
1. Repositories read/write typed state DTOs.
2. Durable engine is isolated from domain validators and business rules.
3. A future provider (SQLite/PostgreSQL/etc.) can replace the file adapter by implementing equivalent load/save/reset semantics.

## Test Isolation
In test mode, persistence root isolates by worker id to prevent cross-worker file conflicts.

## Failure Model
1. Serialization/schema mismatch -> FoundationPersistenceSerializationError.
2. Revision mismatch -> FoundationPersistenceConflictError.
3. Disk write failure -> FoundationPersistenceError (PERSISTENCE_WRITE_FAILED).
