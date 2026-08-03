# Runtime Dependency Model

## Phase 2 Dependency Direction
Replay

↓

IBR

↓

Entity

↓

Relationship

↓

Business Rule

↓

Business Genome Assembly Runtime

## Dependency Constraints
- No reverse dependencies.
- No runtime redesign of Phase 1 layers.
- Downstream runtimes may consume upstream contracts only.
- Cross-layer shortcuts are disallowed.

## Rationale
The sequence isolates concerns:
- IBR interprets observations.
- Entity establishes canonical identity.
- Relationship defines directional semantic links.
- Business Rule governs behavior and policy evaluation.
- Business Genome Assembly Runtime produces the integrated canonical semantic graph output artifact: Business Genome.