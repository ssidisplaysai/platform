# 12 Ownership Resolution Model

## Ownership Scope
The compiler shall resolve accountable ownership for:
1. Capabilities
2. Programs
3. Packages
4. Artifact contexts
5. Applications
6. Runtime subsystems
7. Validation authorities
8. Certification authorities

## Ownership Fields
1. accountableOwnerId
2. supportingOwnerIds
3. constitutionalHomeId
4. governanceAuthorityId
5. ownershipSource
6. ownershipResolutionMethod

## Resolution Order
1. Explicit certified owner declaration.
2. Explicit certified constitutional home ownership rule.
3. Certified inheritance rule from governing program or capability domain.
4. Explicit override rule from higher authority evidence.

## Conflict Handling
1. Multiple accountable owners without policy: error.
2. Circular ownership: fatal.
3. Cross-domain ownership conflict: error.
4. Platform/application boundary conflict: fatal when it causes Genesis ownership of application business logic or application ownership of Genesis platform capability.
5. Missing accountable owner: error, freeze-blocking unless governing standard explicitly permits unowned entity type.

## Freshness-Aware Ownership Rules
1. Accountable ownership cannot be finalized from STALE_BLOCKING, EXPIRED, or INVALID evidence.
2. STALE_NON_BLOCKING ownership evidence may support provisional resolution only when no conflicting CURRENT evidence exists.
3. Ownership derived from stale evidence is marked degraded and cannot satisfy certification or freeze gates.
4. Superseded ownership sources remain lineage-visible and non-authoritative for current-state ownership.
