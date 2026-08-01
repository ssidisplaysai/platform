# Relationship Lifecycle

## Purpose
Define lifecycle states and governance transitions for canonical relationships.

## Lifecycle States
- DRAFT
- VALIDATED
- ACTIVE
- MODIFIED
- SUPERSEDED
- RETIRED

## Required Lifecycle Capabilities
WS-IIIC SHALL govern:
- Creation
- Validation
- Activation
- Modification
- Supersession
- Retirement
- Historical Preservation
- Replay

## Transition Rules
1. Creation
- Requires governed relationship evidence and canonical source/target entities.

2. Validation
- Requires rule conformance checks and evidence sufficiency checks.

3. Activation
- Requires validation success and governance eligibility.

4. Modification
- SHALL NOT mutate prior immutable records.
- SHALL create a new appended decision state with lineage link.

5. Supersession
- SHALL create a successor relationship record.
- SHALL link predecessor and successor identifiers.

6. Retirement
- SHALL preserve historical traceability.
- SHALL include retirement rationale and timestamp.

## Historical Preservation
Historical lifecycle states SHALL remain queryable as immutable records for audit and replay.

## Lifecycle Determinism
Given identical lifecycle inputs and version context, lifecycle outcomes SHALL be deterministic.
