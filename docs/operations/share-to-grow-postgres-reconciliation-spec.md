# Share-to-Grow PostgreSQL Reconciliation Specification (Draft, Read-only Analysis)

Date: 2026-10-13  
Status: Draft (no migration executed)  
Scope: Staging `share-to-grow-repository` namespace only

## 1. Problem Statement

Two valid but divergent persistence snapshots currently exist for Share-to-Grow financial history:

- PostgreSQL-backed snapshot (historical runtime lineage)
- Filesystem/EFS-backed snapshot (current staging runtime)

Both are produced by the same logical repository model, but they are no longer identical. A deterministic reconciliation process is required before PostgreSQL can be promoted as financial authority.

## 2. Canonical Data Model and Identity Keys

The namespace remains `share-to-grow-repository` with these collections and identity keys:

- `participants` → `participantId`
- `trackingIdentities` → `trackingIdentityId`
- `ruleVersions` → `id`
- `sourceEventReceipts` → `sourceEventId`
- `processedCommerceLines` → `lineKey` (canonical commerce-line identity)
- `ledgerEntries` → `id`
- `payoutEntitlements` → `entitlementId`
- `commerceAdjustments` → `adjustmentId`

Secondary uniqueness / collision-sensitive fields:

- `ledgerEntries.idempotencyKey`
- `processedCommerceLines.ledgerEntryIds[*]`
- `processedCommerceLines.sourceEventId`
- `payoutEntitlements.ledgerEntryId`
- `commerceAdjustments.reversalLedgerEntryIds[*]`
- `commerceAdjustments.lineRefunds[*].lineKey`

## 3. Read-only Inventory Tool Design

Implement a read-only inventory tool with two adapters:

1. Filesystem adapter:
   - Reads `/mnt/genesis-persistence/foundation/share-to-grow-repository.json`
   - Validates envelope shape (`schemaVersion`, `revision`, `updatedAt`, `data`)
2. PostgreSQL adapter:
   - Reads `public.genesis_foundation_state` row where `namespace='share-to-grow-repository'`
   - No writes, no locks, no schema changes

For each collection:

- Emit sorted IDs
- Emit canonical content hash per ID (stable JSON canonicalization)
- Emit counts and dependency integrity checks
- Emit lifecycle totals:
  - ledger earning/reversal/net minor totals
  - entitlement totals by state

Output format: one JSON manifest per backend, plus one collision report.

## 4. Collision Classification Rules

For each collection identity key:

1. **Exact duplicate**
   - ID exists in both backends and canonical content hash matches.
2. **Unique to PostgreSQL**
   - ID exists only in PostgreSQL manifest.
3. **Unique to filesystem**
   - ID exists only in filesystem manifest.
4. **Same identity, conflicting content**
   - ID exists in both but canonical content hash differs.

For `ledgerEntries`, run the same classification by `idempotencyKey` as a second pass.

## 5. Deterministic Reconciliation Rules (Apply Phase, Future Work)

### 5.1 Global Principles

- Append-only accounting semantics must be preserved.
- No recomputation of historical earnings.
- No destructive rewrites of existing posted economics.
- Fail closed on unresolved conflicts.

### 5.2 Rule Set

1. **Exact duplicates**: no-op.
2. **Unique records**: eligible for import, subject to dependency checks.
3. **Conflicting same-identity records**: hard stop; require explicit operator adjudication artifact.
4. **`processedCommerceLines` collisions**:
   - Never create a second economic effect for same `lineKey`.
   - If both exist and differ, stop.
5. **`sourceEventReceipts` collisions**:
   - Same `sourceEventId` must be byte-equivalent at canonical hash level.
   - Any mismatch is fatal conflict.
6. **Ledger collisions**:
   - `id` and `idempotencyKey` must remain unique.
   - If same `idempotencyKey` maps to different content, stop.
7. **Entitlement lifecycle conflicts**:
   - Same `entitlementId` with differing state/amount is fatal conflict.
   - Never regress lifecycle (`paid`/`payable` must not be downgraded by merge logic).
8. **Adjustment/reversal validation**:
   - Each `reversalLedgerEntryId` must resolve to a ledger entry.
   - Each `lineRefunds.lineKey` must resolve to a processed line.
9. **Attribution/rule provenance**:
   - Preserve original `ruleVersionId` and attribution snapshot exactly as persisted.
10. **Historical #665 protection**:
   - Keep historical organic allocation immutable.
   - Any correction must be separate, append-only, and separately authorized.

## 6. Referential Integrity Gates

Reject apply if any backend has:

- entitlement referencing missing ledger entry
- processed line referencing missing ledger ID
- processed line referencing missing source receipt
- adjustment referencing missing reversal ledger entry
- adjustment refund line referencing missing processed line
- reversal ledger entry missing source earning entry

## 7. Snapshot, Hash, and Manifest Architecture

Before any apply run:

1. Capture immutable source snapshots:
   - PostgreSQL row export (namespace row only)
   - Filesystem namespace file copy
2. Compute and persist:
   - raw artifact SHA-256
   - canonical data SHA-256
   - per-collection ID hash maps
3. Generate manifest IDs:
   - `manifest_pg_<ts>_<sha>`
   - `manifest_fs_<ts>_<sha>`
   - `manifest_diff_<ts>_<sha>`

Store manifests as auditable artifacts in repository evidence paths or approved secure staging artifact storage.

## 8. Controlled Apply Design (Future Authorization Required)

Default mode must be `--dry-run`.

Apply mode requirements:

- explicit `--confirm-apply`
- explicit source manifest IDs
- explicit destination expected revision (CAS)
- single transaction over destination row update
- idempotent resume behavior:
  - re-running with same manifests must produce same result
  - no duplicate ledger/economic effects

## 9. Concurrency Control and Cutover Safety

A write freeze (or equivalent proven mechanism) is mandatory during final reconciliation:

- Pause webhook financial writes or route them to a durable queue.
- Record freeze start marker and latest accepted receipt ID.
- Reconcile from consistent snapshots.
- Validate no post-snapshot writes were missed before authority switch.

Without write freeze, cutover risks lost or split transactions between backends.

## 10. Rollback and Recovery

Rollback plan (for future apply):

1. Keep pre-apply PostgreSQL snapshot and filesystem snapshot immutable.
2. If post-apply verification fails:
   - restore destination row from pre-apply snapshot in one transaction
   - verify canonical hash and revision expectation
3. Preserve apply logs and failure diagnostics for audit.

## 11. Staging Certification Test Requirements

Before authorizing production-like authority switch:

1. Run dry-run inventory repeatedly; verify deterministic outputs.
2. Validate conflict handling with injected synthetic conflict fixtures.
3. Validate idempotent re-run of dry-run and apply-preview paths.
4. Validate #665 and #666 regression checks:
   - #665 remains historical organic
   - #666 remains Daniel direct 50/50
5. Validate post-merge read-only audit endpoint parity.

## 12. Authority Boundary Recommendation

Current architecture selects one Foundation backend for all modules in a runtime process. Switching `GENESIS_STATE_BACKEND` affects all Foundation-state namespaces, not only Share-to-Grow.

Recommended long-term boundary:

- Introduce a dedicated Share-to-Grow persistence selector (or dedicated store wiring) so financial authority can move to PostgreSQL without unintentionally moving unrelated Foundation namespaces.

This boundary change is separate from reconciliation and requires independent design/authorization.

## 13. Operational Authorization Gates

No apply execution unless all are true:

1. Read-only collision report reviewed and approved.
2. Zero unresolved conflicting same-identity records.
3. Referential integrity checks pass.
4. Write freeze plan approved.
5. Rollback artifacts prepared and verified.
6. Dry-run evidence signed off.

