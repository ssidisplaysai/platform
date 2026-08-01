# Genome Versioning

## Purpose
Define constitutional version governance for assembled Business Genomes.

## Version Domains
WS-IIIE SHALL govern:
- Genome Version
- Snapshot Version
- Delta Version
- Assembly Version
- Publication Version
- Historical Preservation
- Rollback

## Version Contracts
1. Genome Version
- Identifies an immutable assembled genome state.

2. Snapshot Version
- Identifies a full-state assembled representation.

3. Delta Version
- Identifies a governed change set between snapshots.

4. Assembly Version
- Identifies assembly contract and operation context version.

5. Publication Version
- Identifies publication state and release lineage.

## Historical Preservation
All versions SHALL be historically preserved for replay, audit, and certification.

## Rollback Governance
Rollback SHALL be governed as a new versioned state transition and SHALL NOT mutate historical records.
