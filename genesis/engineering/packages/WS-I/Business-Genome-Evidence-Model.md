# Business Genome Evidence Model

## Evidence Mission
Define immutable evidence contracts that support canonical entities and relationships without interpretation drift.

## Evidence Classes
- primary source evidence
- derived but deterministic evidence
- policy evidence
- procedural evidence
- operational evidence
- audit evidence

## Evidence Attributes
- evidenceId
- evidenceType
- sourceClass
- sourceUriOrReference
- sourceOwner
- captureTimestamp
- normalizationMethod
- integrityHash
- validationStatus
- governingPolicyRef
- associatedEntityRefs
- associatedRelationshipRefs

## Evidence States
- CAPTURED
- VALIDATED
- CERTIFIED
- REVOKED

State transitions are versioned and auditable.

## Evidence Constraints
1. Evidence cannot be deleted once referenced by active canonical objects.
2. Evidence integrity hash is immutable per version.
3. Evidence validation is explicit; unknown validity cannot be treated as valid.
4. Evidence references must be resolvable in governance context.

## Evidence Certification Inputs
- source fidelity verification
- normalization reproducibility
- integrity hash verification
- governance policy compliance

## Cross-References
- Business-Genome-Provenance-Model.md
- Business-Genome-Versioning-Model.md
- Business-Genome-Invariants.md
