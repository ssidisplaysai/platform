# GCT-1001 Contact Baseline

## Scope
This baseline documents existing contact-adjacent artifacts and compatibility constraints for establishing the canonical Genesis Contact Platform implementation in `src/platform/contact`.

## Files Inspected
- `src/domain/entities/Customer.ts`
- `src/types/models/Customer.ts`
- `src/data/customers/customers.ts`
- `src/platform/notifications/services/RecipientResolver.ts`
- `src/lib/gba/customer-success-models.ts`
- `src/app/api/gop/messaging/health/route.ts`
- `src/app/api/gop/messaging/metrics/route.ts`
- `src/lib/gop/events-api.ts`
- `src/platform/organization/runtime/index.ts`
- `src/platform/contact/contracts/index.ts`
- `src/platform/contact/persistence/FileContactStore.ts`
- `src/platform/contact/persistence/PersistenceCoordinator.ts`
- `src/platform/contact/services/ContactRegistry.ts`
- `src/platform/contact/services/ContactIdentityService.ts`

## Authorities and Canonical Boundaries
- Canonical contact domain authority is `src/platform/contact/contracts/index.ts`.
- Contact persistence authority is `src/platform/contact/persistence/*` with schema `contact-state.v1.json` and `schemaVersion: 1.0.0`.
- Organization reference validation authority is `src/platform/organization/runtime/index.ts`, accessed through `src/platform/contact/integration/OrganizationContactAdapter.ts`.
- Mission Control observability compatibility authority is `src/lib/gop/events-api.ts` plus `src/app/api/gop/*/health|metrics/route.ts` patterns.

## Duplicate Models and Overlaps
- Existing customer-centric models (`src/domain/entities/Customer.ts`, `src/types/models/Customer.ts`, `src/lib/gba/customer-success-models.ts`) overlap with contact attributes (identity/profile/contact channels) but are not a full Contact Platform boundary.
- Recipient targeting behavior in `src/platform/notifications/services/RecipientResolver.ts` overlaps with communication eligibility concerns.
- Existing GOP metrics and health route patterns overlap with required contact observability contracts.

## Migration Constraints
- Contact runtime must preserve tenant isolation as fail-closed behavior.
- Contact state must be durable in `data/contact/contact-state.v1.json` with lock-serialized writes and schema normalization.
- Existing customer models cannot be force-removed during GCT-1001; compatibility adapters are required until downstream migration completes.
- Runtime-generated data under `data/` must remain untracked and untouched by packaging logic.

## Compatibility Risks
- Divergence risk between legacy customer profile fields and contact canonical contracts if dual-write is introduced without reconciliation.
- Eligibility inconsistency risk if notification routing relies on legacy customer flags rather than canonical contact consent/preferences.
- Cross-tenant contamination risk during affiliation and merge operations if org/contact references are not tenant-validated at service boundary.
- Observability drift risk if contact metrics are exposed in dedicated routes but omitted from GOP aggregate metrics response.

## Baseline Decision Record
- Contact Platform implementation proceeds as a new canonical module under `src/platform/contact`.
- Existing customer artifacts remain operational and are treated as legacy integration surfaces.
- GCT-1001 includes dedicated contact health and metrics routes and GOP aggregate observability integration.

## Continuation Delta
- Prisma prerequisite was executed directly in shell scope with temporary `DATABASE_URL`, and `prisma generate` succeeded before typecheck evaluation.
- Contact hardening was expanded for method transitions, consent expiration, deterministic dedup signal coverage, and recovery organization integrity checks.
- Contact mission-control integration now has dedicated endpoint tests plus GOP aggregate compatibility assertions.
