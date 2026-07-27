# Genesis Business Agent Invariants

## Constitutional Invariants
1. Business Agents never own Enterprise Domain canonical entities.
2. Business Agents never directly modify another Business Agent's state.
3. Every capability has exactly one owning Business Agent.
4. All mutations occur through the owning agent service boundary.
5. Recommendations never mutate business state by themselves.
6. Executive consumes intelligence but does not own functional capabilities.
7. Applications orchestrate user interaction only.
8. Runtime orchestrates execution only.
9. Authorization defaults to deny unless explicitly allowed.
10. Workspace boundaries are enforced before interaction.
11. Cross-agent communication is contract-bound and read-only for consumers.
12. Circular ownership dependencies are prohibited.
13. Circular write dependencies are prohibited.
14. Deterministic replay is required for equivalent input state.
15. Lineage/audit evidence must be preserved for critical intelligence events.

## Ownership Invariants
1. Ownership cannot be duplicated.
2. Ownership cannot be implicitly transferred via dependency.
3. Ownership cannot be overridden by consumer interpretation.

## Security Invariants
1. Authentication required for route and runtime access.
2. Authorization action scopes must match module boundaries.
3. Review actions are distinct from read actions.
4. Cross-workspace access is denied unless membership and policy allow it.

## Integration Invariants
1. Integration occurs through explicit contracts.
2. Additive evolution is preferred; breaking changes require governance approval.
3. Consumer compatibility expectations must be declared per contract.

## Certification Invariants
1. Architecture package can define policy without changing runtime behavior.
2. New agents must pass invariant compliance before certification.
3. Frozen packages remain immutable unless new governance package authorizes change.
