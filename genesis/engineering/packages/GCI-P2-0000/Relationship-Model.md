# Relationship Model

## Supported Relationship Classes
owns, reports_to, belongs_to, depends_on, uses, creates, approves, governs, located_at, contains, supports, supplies, manufactures, operates.

## Relationship Contract
Each relationship includes:
- deterministic relationship identity
- source entity identity
- target entity identity
- directional class
- validity context
- lineage and provenance references
- version metadata

## Relationship Invariants
- Relationships are directional.
- Relationships are versioned.
- Relationships are replayable.
- Source and target must reference canonical entity identities.