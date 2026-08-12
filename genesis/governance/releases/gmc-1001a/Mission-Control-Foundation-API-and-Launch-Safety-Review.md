# Mission Control Foundation API and Launch Safety Review

Work Order: GMC-1001A
Date: 2026-07-30
Review Outcome: FAIL FOR CERTIFICATION (BLOCKERS)

## API Review

Reviewed endpoints:
- /api/gmc/workspace
- /api/gmc/applications
- /api/gmc/navigation
- /api/gmc/dashboard
- /api/gmc/launch-metadata/[applicationId]
- /api/gmc/search
- /api/gmc/health-summary

Findings:
1. Endpoint coverage and internal consistency
- PASS: required endpoint surfaces exist and return presentation models.

2. Error handling
- PASS: unknown launch-metadata application returns 404.

3. Application-specific endpoint absence
- PASS: no application-specific API routes present.

4. System-of-record mutation
- PASS: no mutable registration or health-write ownership via GMC API.

## UI Review

Reviewed:
- src/components/gmc/mission-control-foundation.tsx
- src/modules/mission-control/MissionControlPage.tsx

Findings:
- PASS: cards, navigation, dashboard, and filter/search are generated from workspace models.
- PASS: no direct repository access and no direct EAR/EHC engine calls in UI component.
- PASS: no hardcoded enterprise application list in reviewed UI surfaces.

## Search Safety Review

Findings:
1. Search source
- PASS: search operates on dynamic application dataset assembled through GMC service.

2. Supported fields
- PASS: name, company, category, description, and capability fields are searchable.

3. Determinism
- PASS: filtering logic is deterministic for equal input.

4. Registration-status gating for launch
- FAIL (High): inactive entries can remain launchable when displayed because launch actions are not status-gated.
- Affected files: src/platform/gmc/mission-control-service.ts, src/components/gmc/mission-control-foundation.tsx.

## Launch Safety Review

Blocker 1 (High): inactive applications are not blocked from launch
- Behavior: getLaunchMetadata returns launch target without lifecycle gate; UI renders launch action unconditionally.
- Affected files:
  - src/platform/gmc/mission-control-service.ts
  - src/components/gmc/mission-control-foundation.tsx

Blocker 2 (High): unavailable or incompatible applications are not blocked by launch policy
- Behavior: launch resolution does not enforce availability or compatibility policy before launch metadata exposure.
- Affected files:
  - src/platform/gmc/mission-control-service.ts
  - src/components/gmc/mission-control-foundation.tsx

Blocker 3 (High): protocol-relative path exposure risk
- Behavior: internal launch path accepts values starting with slash without rejecting double-slash protocol-relative form.
- Affected file:
  - src/platform/gmc/launch-policy-resolver.ts

Blocker 4 (Medium): launch-safety negative tests absent
- Behavior: automated tests do not assert rejection behavior for inactive/unavailable/incompatible launch conditions.
- Affected files:
  - tests/gmc/launcher.test.ts
  - tests/gmc/workspace.test.ts

## Certification Impact

These launch-safety defects are classified as certification blockers under GMC-1001A and prevent CERTIFIED status.
