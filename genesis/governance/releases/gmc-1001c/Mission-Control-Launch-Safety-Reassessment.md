# Mission Control Launch Safety Reassessment

Work Order: GMC-1001C
Date: 2026-07-30

## Assessment Objective
Determine whether launch-safety behavior now satisfies certification expectations after GMC-1001B.

## Task 3: Launch Policy Review
Reviewed:
- src/platform/gmc/types.ts
- src/platform/gmc/launch-policy-resolver.ts
- src/platform/gmc/mission-control-service.ts

Findings:
1. Launch decision taxonomy is explicit and deterministic:
   - ALLOWED
   - BLOCKED_INACTIVE
   - BLOCKED_UNAVAILABLE
   - BLOCKED_INCOMPATIBLE
   - BLOCKED_MISSING_METADATA
   - BLOCKED_INVALID_TARGET
2. Launch policy is centralized in mission-control-service resolver-driven decisions.
3. Service-side enforcement is authoritative; UI/API consume service output.
4. Blocked states do not expose safeLaunchTarget.
5. Allowed states expose only resolver-validated safeLaunchTarget.
6. Missing metadata fails closed.
7. Unknown application returns null at service and 404 at API handler.
8. EAR and EHC remain authoritative sources for registration and health/compatibility state.

Conclusion: PASS

## Task 4: Internal Route Safety Review
Policy Evidence:
- Internal path must begin with "/".
- Protocol-relative values beginning "//" are blocked.
- Backslashes are blocked.
- Control characters are blocked.
- Blank path is blocked.
- Scheme-prefixed values (javascript:, data:, file:, vbscript:, etc.) are blocked before internal-route handling.

Representative Positive Evidence:
- launcher.test.ts allows "/glw" as valid INTERNAL target.

Representative Negative Evidence:
- launcher.test.ts blocks "//evil.example.com".
- launcher.test.ts blocks internal backslash/control-char paths.
- launcher.test.ts blocks blank path.

Conclusion: PASS with evidence condition
Condition:
- Add explicit malformed internal route test variant for multi-slash internal shape if governance requires narrower internal path canonicalization evidence.

## Task 5: External URL Safety Review
Policy Evidence:
1. HTTPS allowed.
2. HTTP allowed only for localhost/127.0.0.1/::1.
3. Non-loopback HTTP blocked.
4. Unsupported/non-http schemes blocked.
5. Malformed URLs fail closed by URL parsing.
6. Credentialed URLs blocked.
7. Protocol-relative values blocked.
8. No open redirect observed in resolver behavior because returned EXTERNAL targets are URL-validated and baseUrl composition remains anchored to parsed URL host.

Representative Positive Evidence:
- launcher.test.ts allows https absolute launch.
- launcher.test.ts allows localhost http launch.

Representative Negative Evidence:
- launcher.test.ts blocks javascript/data scheme examples.
- launcher.test.ts blocks credentialed URL.
- launcher.test.ts blocks non-loopback http host.
- launcher.test.ts blocks protocol-relative value.

Conclusion: PASS with evidence condition
Condition:
- Add explicit malformed URL test case (parser failure) to convert inferred behavior into direct regression evidence.

## Task 6: Service and API Enforcement Review
Reviewed:
- src/lib/gmc/mission-control-api.ts
- src/app/api/gmc/workspace/route.ts
- src/app/api/gmc/applications/route.ts
- src/app/api/gmc/dashboard/route.ts
- src/app/api/gmc/launch-metadata/[applicationId]/route.ts
- src/app/api/gmc/search/route.ts

Findings:
1. Blocked applications do not expose executable targets in launch metadata.
2. Blocked launch requests return fail-safe 409 with policy metadata.
3. Unknown applications return 404.
4. Presentation endpoints expose block reasons through launch metadata safely.
5. Route adapters do not recreate launch policy; they delegate to lib handler/service.
6. No mutable system-of-record behavior present in API routes.

Conclusion: PASS

## Task 7: UI Enforcement Review
Reviewed:
- src/components/gmc/mission-control-foundation.tsx
- src/modules/mission-control/MissionControlPage.tsx

Findings:
1. Launch controls render only when launchAllowed and safe target are present.
2. Blocked applications render reason text and no executable href.
3. UI consumes service-assembled workspace and does not compute policy state independently.
4. No bypass of service-side gating identified.
5. No unrelated visual redesign or feature expansion identified in reviewed files.

Conclusion: PASS

## Task 8: Negative Coverage Review
Reviewed:
- tests/gmc/launcher.test.ts
- tests/gmc/workspace.test.ts
- tests/gmc/fixtures.ts

Directly Covered:
- Valid internal route allowed
- Valid HTTPS URL allowed
- Inactive application blocked
- Unavailable application blocked
- Incompatible application blocked
- Missing launch metadata blocked
- Invalid launch metadata blocked
- Protocol-relative target blocked
- javascript blocked
- data blocked
- Backslash target blocked
- Credentialed URL blocked
- Non-loopback HTTP target blocked
- Blocked workspace application has no executable target

Not Directly Covered (material evidence conditions):
1. Unknown application fails safely (code present, direct test absent)
2. Blocked search result is not launchable (policy path implies this, direct test absent)
3. Malformed URL parser-failure case explicit test absent
4. Double-slash internal path variant beyond protocol-relative case not directly asserted

Conclusion: PASS with CONDITIONS
