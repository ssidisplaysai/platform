# Stop Conditions

Stop implementation work immediately if any of the following occur:
- a proposed behavior crosses into relationships, rules, or genome assembly;
- evidence is insufficient to support deterministic canonicalization;
- upstream observations would need to be mutated;
- hidden inference, heuristics, or probabilistic behavior appears;
- persistence, orchestration, or side effects are introduced;
- repository or package integrity becomes non-deterministic.

Unresolved identity must remain unresolved.