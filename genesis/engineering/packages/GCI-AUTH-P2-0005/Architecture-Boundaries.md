# Architecture Boundaries

## Runtime Position
The Business Genome Assembly Runtime is authorized as the final deterministic compiler-runtime stage after upstream runtime validations complete.

## Input Boundary
Authorized inputs are immutable outputs from:
- Evidence Runtime
- Evidence Validation Runtime
- Manifest Runtime
- Replay Runtime
- IBR Runtime
- Entity Runtime
- Relationship Runtime
- Business Rule Runtime

## Output Boundary
Authorized outputs are immutable canonical Business Genome records and append-only lineage/state transitions derived deterministically from authorized inputs.

## Authority Boundary
The runtime assembles and links only. It must not infer, reinterpret, or create semantic meaning beyond deterministic composition rules.

## Infrastructure Boundary
The runtime must not own persistence, orchestration, scheduling, deployment, queueing, workers, or workflow engines.
