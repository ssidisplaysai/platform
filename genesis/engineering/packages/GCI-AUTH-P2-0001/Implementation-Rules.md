# Implementation Rules

## Determinism Rules
- Equivalent replay inputs must produce equivalent observation outputs.
- Processing order must be deterministic and explicitly defined.
- No random, time-variant, or environment-variant behavior in core transformations.

## Immutability Rules
- Source replay artifacts are read-only.
- Observation records are append-only by version.
- Historical lineage cannot be rewritten.

## Identity Rules
- Observation identity must be derived from canonicalized deterministic input material.
- Identity collisions are treated as critical defects.
- Identity does not mutate; new versions supersede.

## Version Lineage Rules
- Every emitted observation version references prior lineage state.
- Supersedence chains must be acyclic and complete.

## Failure Behavior Rules
- Fail closed on invalid input shape, missing lineage linkage, or nondeterministic branch detection.
- Emit explicit deterministic error artifacts suitable for certification evidence.

## Boundary Rules
- No canonical entity/relationship creation.
- No business rule evaluation.
- No genome assembly behavior.
- No orchestration, persistence, scheduling, AI, OCR, crawler, queue, or worker responsibilities.