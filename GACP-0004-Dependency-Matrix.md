# GACP-0004 Dependency Matrix

Date: 2026-07-28
Package: GACP-0004

## 1. Architectural Direction
Certified dependency policy retained from GACD-0002:
- Applications -> Public Platform APIs
- Platform services -> runtime internals (internal only)
- No new application -> implementation shortcuts introduced

## 2. Capability Registry Dependency Convergence
| Consumer Surface | Before | After |
|---|---|---|
| src/lib/gea/agent-api.ts | Direct capability registry construction | Consumes shared runtime registry authority factory |
| src/lib/gea/orchestration-api.ts | Direct capability registry construction in multiple paths | Consumes shared runtime registry authority factory |
| src/components/gea/gea-workspace.tsx | Direct capability registry construction | Consumes shared runtime registry authority factory |
| src/components/gea/gea-orchestration-workspace.tsx | Direct capability registry construction | Consumes shared runtime registry authority factory |
| src/lib/gba/executive-runtime.ts | Direct in-memory capability constructor | Consumes authoritative capability constructor |
| src/lib/gba/operations-runtime.ts | Direct in-memory capability constructor | Consumes authoritative capability constructor |
| src/lib/gba/manufacturing-runtime.ts | Direct in-memory capability constructor | Consumes authoritative capability constructor |

## 3. Dependency Validation Evidence
GAR dependency evidence source:
- genesis/audits/GAR-0002/evidence/dependency-direction-analysis.json

Measured count snapshot:
- application-to-implementation: 104

Validation command:
- npm run gar2:validate -> valid=true

## 4. Dependency Policy Outcome
- Dependency direction policy: PRESERVED
- New dependency-policy violations: NONE DETECTED
- Application dependency boundary drift: NONE DETECTED
