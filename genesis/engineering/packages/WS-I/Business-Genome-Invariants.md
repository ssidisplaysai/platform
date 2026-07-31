# Business Genome Invariants

## Purpose
Define non-negotiable constitutional rules that must hold for all canonical model artifacts.

## Global Invariants
1. Identity determinism invariant
- Equal normalized inputs produce equal canonical identities.

2. Single authority invariant
- Every canonical object has exactly one authority owner at any effective version.

3. Evidence completeness invariant
- No active canonical claim exists without evidence references.

4. Provenance completeness invariant
- No active canonical claim exists without full provenance chain.

5. Version integrity invariant
- Version transitions are append-only and auditable.

6. Lifecycle validity invariant
- Lifecycle transitions must follow allowed transition graph only.

7. Boundary non-overlap invariant
- Authority boundaries cannot overlap for the same canonical scope.

8. Extension safety invariant
- Extensions cannot redefine core canonical semantics.

## WS-I Verification Rules
- Every WS-I document maps to one or more invariants.
- Any invariant violation blocks certification readiness.

## Cross-References
- Business-Genome-Boundary-Matrix.md
- Business-Genome-Ownership-Matrix.md
- Business-Genome-Extension-Model.md
- Certification-Checklist.md
