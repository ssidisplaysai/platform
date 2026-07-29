# 22 Impact Analysis Model

## Propagation Planes
1. Direct dependencies
2. Transitive dependencies
3. Constitutional authority impact
4. Governance authority impact
5. Capability impact
6. Program impact
7. Package impact
8. Artifact impact
9. Runtime subsystem impact
10. Application impact
11. Validation impact
12. Certification impact
13. Release impact

## Required Impact Classifications
1. AUTHORITATIVE
2. DERIVED
3. POTENTIAL
4. UNKNOWN

## Propagation Rules
1. Direct authoritative edge impact propagates as authoritative only when downstream edge is authoritative.
2. Transitive impact is derived unless all intermediate edges are authoritative and directly declared.
3. Unknown or potential edges propagate no higher than potential.
4. Cycle handling records traversal cutpoints and marks impact confidence as bounded.
5. Superseded dependencies remain lineage-visible and excluded from active impact by lifecycle state.
6. Impact authority cannot be upgraded above the weakest freshness status in the traversed evidence chain.
7. STALE_BLOCKING, EXPIRED, or INVALID evidence in impact-critical paths yields BLOCKED impact conclusions for certification and freeze scopes.
