# Risk Assessment

## Primary Risks
1. Scope creep into downstream runtimes.
2. Hidden nondeterminism in observation transformation.
3. Incomplete lineage and linkage propagation.
4. Infrastructure coupling introduced too early.
5. Ambiguous ownership of runtime and certification outcomes.

## Risk Severity
- Scope creep: High
- Nondeterminism: High
- Lineage gap: High
- Infrastructure coupling: Medium
- Ownership ambiguity: Medium

## Mitigation Controls
- hard boundary enforcement and fail-closed behavior
- mandatory deterministic test matrix
- independent certification gate before integration
- explicit dependency allow/deny lists
- named governance and certification owners