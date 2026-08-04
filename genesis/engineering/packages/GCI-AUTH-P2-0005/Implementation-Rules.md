# Implementation Rules

## Mandatory Rules
- implement deterministic assembly only
- maintain immutable output objects and immutable registry semantics
- preserve provenance and append-only lineage
- preserve unresolved and contradictory states without heuristic override
- enforce deterministic versioning, supersedence, and retirement transitions

## Prohibited Rules
- do not infer, guess, or apply probabilistic reasoning
- do not use AI/LLM or heuristic decisioning
- do not resolve identity/relationship contradictions beyond upstream canonical outputs
- do not evaluate business rules within assembly runtime
- do not mutate upstream runtime outputs
- do not own persistence/orchestration/scheduling/deployment/queues/workers/workflow execution
- do not emit side effects

## Scope Rule
If proposed behavior exceeds authorized boundaries, implementation must stop and request separate constitutional authorization.
