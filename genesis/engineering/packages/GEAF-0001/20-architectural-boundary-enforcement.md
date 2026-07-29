# 20 Architectural Boundary Enforcement

## Hard Boundaries
1. GEAF shall not define runtime behavior.
2. GEAF shall not define compiler algorithms.
3. GEAF shall not define APIs, persistence, deployment, infrastructure, or UI behavior.
4. GEAF shall not absorb STONER business semantics.
5. GEAF shall not alter certified/frozen source artifacts.

## Boundary Sources
- GAF-0001 scope exclusions.
- GCSA-PROGRAM-0001 program limits.
- GCSA-0001 architecture-only declarations.
- AFR-0004 freeze constraints.
- BGC-0001 non-responsibilities.

## Enforcement Outcome
All GEAF outputs comply with hard boundaries.