# Stop Conditions

Stop implementation work immediately if any of the following occur:
- a proposed behavior crosses into Business Rule Runtime or Business Genome Assembly Runtime;
- evidence is insufficient to support deterministic relationship canonicalization;
- upstream records would need to be mutated;
- hidden inference, heuristics, or probabilistic behavior appears;
- persistence, scheduling, orchestration, queues, workers, or deployment side effects are introduced;
- repository or package integrity becomes non-deterministic.

Unresolved relationships must remain unresolved.
