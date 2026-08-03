# Architecture Boundaries

The Entity Runtime sits between upstream IBR observations and future downstream semantic runtimes.

Permitted boundary behavior:
- contract-only consumption of approved upstream outputs;
- deterministic transformation of observations into entity candidates;
- immutable record construction and registry access.

Forbidden boundary behavior:
- creating canonical relationships;
- evaluating business rules;
- assembling the Business Genome;
- acting as a persistence, queueing, orchestration, or deployment layer;
- mutating upstream records.

The boundary must remain observational and deterministic.