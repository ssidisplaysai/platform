# GACP-0004 Architecture Impact Assessment

Date: 2026-07-28
Package: GACP-0004

## 1. Architectural Change Intent
Reduce fragmented runtime capability registry construction by enforcing a single authoritative construction path.

## 2. Impact Summary
- Runtime authority chain: preserved
- Public API boundaries: preserved
- Dependency direction: preserved
- Capability registry ownership: strengthened
- Registry lifecycle determinism: improved in API handlers by single dependency resolution per handler

## 3. Detailed Impact
1. Capability construction authority is now centralized through:
   - src/lib/gea/capability-registry.ts (authoritative constructor)
   - src/lib/gea/runtime-registry-authority.ts (runtime assembly authority factory)
2. Consumer paths now depend on authority factory rather than local direct constructors.
3. Agent/orchestration API handlers now reuse one resolved dependency bundle per handler, removing repeated runtime bundle reconstruction inside a single request path.

## 4. Constitutional Invariants Check
- Single Runtime Authority (GACD-0001): preserved
- Dependency Direction (GACD-0002): preserved
- Platform Bootstrap isolation (GACD-0003): unaffected
- Public Platform API policy (GACD-0004): preserved
- Registry Authority model (GACD-0005): implemented for capability convergence target

## 5. Risk Assessment
Residual risks:
1. Capability registry remains in-memory runtime authority for this slice (intentional for controlled convergence).
2. Additional GBA/GEA domains beyond this slice may still contain adjacent non-capability registry convergence opportunities.

## 6. Architectural Disposition
APPROVED: change is bounded, non-disruptive, and aligned to certified convergence intent.
