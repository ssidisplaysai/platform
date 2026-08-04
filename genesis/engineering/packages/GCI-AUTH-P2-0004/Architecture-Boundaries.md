# Architecture Boundaries

## Boundary Statement
The Business Rule Runtime is a deterministic evaluation boundary. It consumes immutable inputs from the governed semantic graph and emits immutable rule evaluation artifacts.

## In-Boundary Behavior
- read governed Entity and Relationship outputs
- evaluate explicit rule conditions deterministically
- emit immutable evaluation results
- preserve lineage, provenance, replay linkage, evidence linkage, and certification linkage
- maintain append-only registry behavior
- preserve unresolved rule outcomes as unresolved
- preserve contradictory evidence without silent resolution

## Out-of-Boundary Behavior
- assembling a Business Genome
- mutating source entities or relationships
- persisting operational state
- scheduling work or running background queues
- managing workers, deployment, infrastructure, or databases
- performing inference, heuristics, or probabilistic reasoning
- resolving conflicts outside deterministic rules
- issuing side effects
- silently resolving contradictions

## Boundary Principle
If a behavior requires external state, asynchronous coordination, or nondeterministic choice, it is outside this authorization package. Resolution authority for contradictions belongs only to downstream Business Genome Assembly Runtime or another explicitly authorized downstream runtime.