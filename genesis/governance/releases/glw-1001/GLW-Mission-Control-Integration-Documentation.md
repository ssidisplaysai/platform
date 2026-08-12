# GLW Mission Control Integration Documentation

## Integration Objective
Validate that GLW is dynamically discovered and orchestrated by GMC without hardcoded inventory.

## Verified GMC Touchpoints
1. Workspace application catalog includes GLW.
2. Search returns GLW for relevant query terms.
3. Navigation includes GLW application identity.
4. Dashboard totals include GLW.
5. Launch metadata for GLW is evaluated through GMC launch policy.

## Launch Policy Ownership
GMC owns launch gating and target validation.
GLW provides launch metadata through EAR registration.

## Evidence
- src/platform/gmc/runtime.ts
- src/platform/gmc/mission-control-service.ts
- src/platform/gmc/launch-policy-resolver.ts
- tests/glw/genesis-platform-integration.test.ts
