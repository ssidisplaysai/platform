# Canonical Business Rule Rules

1. Rule identity must be deterministic and stable across replays.
2. Rule versions must be explicit and immutable once published.
3. Rule supersedence must be append-only.
4. Retired rules must remain historically reproducible.
5. Rule lineage must remain append-only.
6. Provenance must preserve the governing source inputs and evaluation path.
7. Rule evaluation must be reproducible from immutable inputs.
8. Rule outputs must not mutate source Entity or Relationship records.
9. Eligibility, compliance, policy, and derived-fact results must be deterministic.
10. Any rule that depends on nondeterministic input is invalid for this authorization boundary.
11. Rule registry behavior must be append-only and traceable.
12. Unresolved rule outcomes must remain unresolved.
13. Contradictory evidence must be preserved.
14. Business Rule Runtime must not silently resolve contradictions.
15. Resolution authority for contradictions belongs only to downstream Business Genome Assembly Runtime or another explicitly authorized downstream runtime.
16. Replay of identical inputs must always produce identical unresolved outcomes.
17. Certification linkage must remain intact from input evidence through evaluation result.