# GBA-0004A Security Certification

## Security Areas Validated
- Authentication: session requirement enforced in marketing API handlers.
- Authorization: GOP resolver action checks for each route.
- Default-deny: unauthorized decisions return 401 or 403 as appropriate.
- Workspace isolation: decisions are workspace-scoped.
- Route protection: protected workspace route access resolver blocks unauthorized routes.
- Module isolation: moduleId gba.marketing used consistently.

## Evidence
- tests/gba/gba-marketing-api.test.ts:
  - unauthenticated request returns 401.
  - invalid recommendation review payload returns 400.
  - viewer mutation denied by policy.
- tests/gba/gba-marketing-authorization.test.ts:
  - viewer denied manage_campaigns.
  - non-member workspace access denied.
- tests/gba/gba-marketing-route-forwarding.test.ts:
  - route map forwards correctly to guarded API handlers.

## Findings
- Blocker: None.
- Major: None.
- Minor: None.
- Observation: None specific to GBA-0004.

## Disposition
APPROVED.
