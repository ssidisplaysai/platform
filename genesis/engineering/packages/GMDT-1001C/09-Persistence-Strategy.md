# 09 Persistence Strategy

Selected implementation-ready shape:
- tenant-partitioned canonical state files
- append-only execution and trace history files
- coordinated snapshots for fast recovery
- recomputable derived projections

Why this shape:
- Manufacturing has both mutable execution state and immutable trace evidence
- state files give deterministic rehydration boundaries
- append-only history preserves audit and traceability
- snapshots support startup and recovery performance
- projection rebuilds remain deterministic and recomputable

Documented storage families:
- canonical collections for work orders, runs, batches, routing, operations, requirements, outputs, assignments, WIP, downtime, and reference metadata
- append-only history for execution facts, trace records, audit entries, idempotency outcomes, and compensating corrections
- projection storage for read models only

Strategy rules:
- schema version is explicit and stored with every partition
- tenant partitioning is mandatory
- canonical state and history are stored separately
- idempotency records are durable and queryable
- recovery metadata includes snapshot version, replay cursor, and invariant status
- projection rebuilds are deterministic and derived only from canonical state/history
- safe writes use temp-file/atomic-rename semantics plus corruption-aware fallback
- corruption behavior is fail-closed; invalid state never becomes ready
- future migration policy prefers additive schema evolution with versioned readers
