# GMC-1001B Mission Control Launch Safety Remediation

Work Order: GMC-1001B
Date: 2026-07-30
Scope: Remediation only

## Objective
Remediate the launch-safety blockers identified in GMC-1001A without expanding Mission Control scope.

## Remediation Summary
1. Added authoritative launch decision model in GMC types with explicit status taxonomy:
   - ALLOWED
   - BLOCKED_INACTIVE
   - BLOCKED_UNAVAILABLE
   - BLOCKED_INCOMPATIBLE
   - BLOCKED_MISSING_METADATA
   - BLOCKED_INVALID_TARGET
2. Hardened launch target resolution:
   - Rejects protocol-relative targets
   - Rejects control characters and backslashes in internal paths
   - Rejects unsafe schemes (javascript, data, file, vbscript, and other non-http prefixes)
   - Rejects malformed URLs and URLs with credentials
   - Restricts http external targets to loopback hosts only
3. Centralized launch gating in Mission Control service:
   - Active lifecycle required
   - Availability required
   - Compatibility required
   - Valid launch metadata required
4. Updated API fail-safe behavior:
   - Returns 409 and policy metadata for blocked launches
   - Returns 404 for unknown application
5. Updated UI launch gating:
   - Renders launch action only when launchAllowed is true
   - Shows explicit blocked reason otherwise
   - Does not render executable target for blocked state
6. Added negative launch-safety tests to validate blocked pathways and target hardening.

## Files Updated
- src/platform/gmc/types.ts
- src/platform/gmc/launch-policy-resolver.ts
- src/platform/gmc/application-launcher.ts
- src/platform/gmc/application-discovery-service.ts
- src/platform/gmc/mission-control-service.ts
- src/lib/gmc/mission-control-api.ts
- src/components/gmc/mission-control-foundation.tsx
- tests/gmc/fixtures.ts
- tests/gmc/launcher.test.ts
- tests/gmc/workspace.test.ts

## Out of Scope
- Re-architecture of EAR/EHC/GMC boundaries
- Recertification decision package (handled in a future certification work order)
