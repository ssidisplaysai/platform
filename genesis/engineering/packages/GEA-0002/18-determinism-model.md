# 18 Determinism Model

## Determinism Guarantees
Identical certified inputs shall produce:
1. Identical entity identifiers.
2. Identical relationship identifiers.
3. Identical graph structure.
4. Identical ordering.
5. Identical validation results.
6. Identical output hashes.
7. Identical machine-readable output payloads.

## Determinism Controls
1. Stable file ordering.
2. Stable repository traversal ordering.
3. Path normalization.
4. Timestamp exclusion from semantic identity.
5. Stable identifier generation from canonical fields.
6. Stable duplicate merge ordering.
7. Stable version selection policy.
8. Stable conflict resolution order.

## Non-Deterministic Input Handling
1. Environment-specific metadata is excluded from semantic graph hash.
2. Non-canonical paths are normalized before extraction.
3. Clock values may appear in diagnostics metadata but not semantic outputs.

## Diagnostic Ordering Guarantee
Diagnostics shall be sorted deterministically using the following key order:
1. severityOrder where FATAL < ERROR < WARNING < INFORMATIONAL
2. ruleId
3. canonicalEntityId
4. canonicalRelationshipId
5. normalizedSourcePath
6. sourceSection
7. stableMessageCode

Human-readable message text shall not affect ordering.
Environment-specific absolute paths and timestamps shall not affect ordering.

## Diagnostic Deduplication
1. Duplicate diagnostics are deduplicated by deterministic key:
	diagnosticIdentityKey = severity|ruleId|canonicalEntityId|canonicalRelationshipId|normalizedSourcePath|sourceSection|stableMessageCode
2. Deduplication runs before final ordering.

## Stable Serialization And Hashing
1. diagnostics.json uses canonical field ordering.
2. Arrays in diagnostics.json are ordered by diagnostic ordering guarantee.
3. Hashes are computed from normalized canonical JSON payloads only.
4. Non-semantic run metadata is excluded from semantic hash computation.
