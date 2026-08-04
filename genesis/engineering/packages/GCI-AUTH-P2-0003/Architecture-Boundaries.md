# Architecture Boundaries

The Relationship Runtime sits between upstream deterministic runtime records and future downstream semantic runtimes.

Permitted boundary behavior:
- contract-only consumption of approved upstream outputs;
- deterministic transformation of governed inputs into relationship candidates;
- immutable relationship record construction and registry access.

Forbidden boundary behavior:
- evaluating or executing business rules;
- assembling the Business Genome;
- acting as a persistence, scheduling, queueing, orchestration, or deployment layer;
- invoking inference systems, heuristics, or probabilistic reasoning;
- mutating upstream records.

The boundary must remain deterministic, contract-only, and side-effect free.
