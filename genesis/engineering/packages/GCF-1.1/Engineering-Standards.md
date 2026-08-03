# Engineering Standards

## Standards Established in Phase 1
1. Deterministic hashing
- Stable SHA-256 identity and digest generation for governed records.

2. Stable serialization
- Canonical stable serialization for deterministic content equivalence.

3. Immutable runtime objects
- Runtime outputs are frozen and append-only.

4. Append-only history
- Version lineage is additive and non-destructive.

5. Explicit lineage
- Manifest, validation, evidence, replay, and certification lineage must remain explicit.

6. Architecture guardrails
- Out-of-scope coupling and reverse dependencies are prohibited and validated.

7. Replay integrity
- Replay identity, fingerprints, and graph linkage must remain deterministic and auditable.

8. Certification evidence
- Each package must include evidence-backed independent certification and closeout artifacts before integration.