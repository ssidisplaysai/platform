# GMP-0006B Analytics Collection Engine v1.0

## Objective
Close GMP-0006B with production-safe collection engine behavior: deterministic timeline contract, operator workflow controls, retry lineage, contract hardening, and validation evidence suitable for freeze recommendation.

## Scope
- Additive timeline contract hardening for `GmpAnalyticsCollectionEvent`.
- Deterministic timeline serialization with explicit event catalog and contract version.
- Bounded, cursor-based timeline retrieval across repository, services, and API.
- Operator controls for source validation/collection execution and collection retry/timeline inspection.
- Forced recollection deferral (`409 FORCED_RECOLLECTION_DEFERRED`) to prevent partial rollout behavior.
- Secret redaction hardening for credential/adapter surfaces.

## Out Of Scope
- New production Google integrations (GA4/GSC live transport).
- GMP-0006C attribution/recommendation/intelligence implementation.
- Architectural redesign of GMP-0006B.

## Timeline Contract v1
- Contract version constant: `gmp-analytics-timeline/v1`.
- Event payload version on timeline entries: `gmp-analytics-collection-event/v1`.
- Additive event metadata:
  - `parentCollectionId`
  - `retryOfCollectionId`
  - `attemptNumber`
  - `batchNumber`
  - `pageNumber`
  - `safeOutcomeSummary`
  - `timelineContractVersion`
- Cursor semantics:
  - Request: `limit`, `afterOccurredAt`, `afterEventId`
  - Response: `events[]`, `nextCursor`
- Determinism:
  - Stable ordering by occurrence/creation/id in persistence and timeline reads.
  - Deterministic serializer for timeline payload emission.

## Operator Workflow Surface
- Source detail controls:
  - Validate source
  - Run collection
  - Source capabilities/health links
  - Safe error rendering + refresh behavior
- Collection detail controls:
  - Retry collection (resume)
  - Timeline API link
  - Retry eligibility and authorization-aware gating messages
- Protected route permission propagation expanded for operator actions.

## Redaction Guarantees
Additional sensitive key patterns are redacted from adapter/credential surfaces:
- `client_secret`
- `private_key`
- `service_account`
- `bearer`
- Existing token/password/api-key style keys remain redacted.

## Database Contract Hardening
Additive migration applied:
- `prisma/migrations/20260727133000_gmp_analytics_timeline_contract_v1/migration.sql`

Schema additions and indexes:
- Event metadata columns listed above.
- Parent/retry timeline access indexes:
  - `GmpAnalyticsCollectionEvent_parentCollectionId_occurredAt_idx`
  - `GmpAnalyticsCollectionEvent_retryOfCollectionId_occurredAt_idx`

## Scope Boundary Determination (0006B vs 0006C)
- Determination: GMP-0006B closure remains within collection engine/operator observability boundaries.
- Current inherited behavior from 0006A still includes normalization/snapshot service paths.
- Closure decision: retain inherited behavior unchanged to avoid redesign and preserve compatibility; do not extend or promote those paths as new 0006B scope.
- Disposition: accepted as pre-existing boundary debt, to be tracked for explicit handling in a later milestone.

## Validation Matrix (Closure Pass)
Executed in this closure pass:

1. `npm test -- tests/gmp/gmp-analytics-services.test.ts tests/gmp/gmp-analytics-api.test.ts`
- Result: PASS (2 suites, 14 tests)

2. `npm test -- tests/gmp/gmp-analytics-services.test.ts`
- Result: PASS (1 suite, 8 tests)

3. `npm test -- tests/gmp/gmp-analytics-adapters.test.ts`
- Result: PASS (1 suite, 5 tests)

4. `npm test -- tests/gmp/gmp-analytics-api.test.ts`
- Result: PASS (1 suite, 6 tests)

5. `npm test -- tests/gmp/gmp-analytics-ui.test.tsx`
- Result: PASS (1 suite, 3 tests)

6. `npm test -- tests/gmp`
- Result: PASS (19 suites, 82 tests)
- Note: one run reported Jest worker forced exit warning; open-handle diagnostics executed below.

7. `npm test -- tests/gop`
- Result: PASS (15 suites, 43 tests)

8. Focused ESLint on GMP-0006B touched runtime/API/UI/test files
- Result: PASS

9. Focused TypeScript diagnostics on GMP-0006B touched files via editor diagnostics
- Result: PASS (no errors in all touched files)
- Note: ad-hoc `tsc` with direct file arguments produced known non-actionable repository/config noise and was not used as closure gate.

10. `npx prisma validate`
- Result: PASS

11. `npx prisma migrate status` (pre-apply)
- Result: pending migration `20260727133000_gmp_analytics_timeline_contract_v1`

12. `npx prisma migrate deploy`
- Result: PASS (pending timeline migration applied)

13. `npx prisma migrate status` (post-apply)
- Result: PASS (database schema up to date)

14. `npx prisma generate`
- Result: PASS

15. `npm test -- tests/gmp --detectOpenHandles`
- Result: PASS (19 suites, 82 tests)

16. `npm test -- tests/gop --detectOpenHandles`
- Result: PASS (15 suites, 43 tests)

## Known Limitations / Debt
- Workspace-wide `npx tsc --noEmit` remains noisy because of existing template placeholder files under `tools/genesis/templates/**`; this is pre-existing and outside GMP-0006B scope.
- 0006A-era normalization/snapshot paths remain present in shared analytics services (retained intentionally for compatibility).

## Freeze Recommendation
Recommendation: GO for GMP-0006B v1.0 freeze.

Rationale:
- Timeline contract hardened end-to-end (model/repository/service/API/schema).
- Operator workflow controls and retry/timeline observability are present and tested.
- Redaction hardening is expanded and validated.
- Full GMP and GOP suites pass, plus open-handle diagnostics and Prisma checks.
- Migration is applied and database status is current.

## Final Disposition
- Status: Approved
- Freeze recommendation: GO
- Version: 1.0
- Disposition: Frozen for Future Reference
