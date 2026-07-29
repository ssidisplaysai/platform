# 14 Graph Construction Model

## Assembly Pipeline
1. Node creation from extracted entities.
2. Node normalization and canonical identifier resolution.
3. Edge creation from extracted or derived relationships.
4. Edge normalization and duplicate merge.
5. Conflict isolation with diagnostic emission.
6. Orphan, root, and cycle analysis.
7. Boundary validation and constitutional ancestry validation.
8. Version-aware graph finalization.

## Prohibited Graph States
1. Duplicate canonical identifiers.
2. Multiple accountable owners without explicit policy.
3. Ownership cycles.
4. Invalid constitutional ancestry.
5. Application ownership of Genesis platform capabilities.
6. Genesis ownership of application-specific business logic.
7. Unproven authoritative edges.
8. Broken package-artifact lineage.
9. Missing evidence references on authoritative or derived edges.

## Dependency And Transitivity
1. Direct dependencies are extracted first.
2. Transitive dependencies are generated deterministically and labeled derived.
3. Superseded dependencies remain lineage-visible but inactive for current impact.
