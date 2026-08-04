# 02 Architecture

## Canonical Module
Contact Platform is implemented as canonical module at `src/platform/contact` with boundaries:
- `contracts`: domain and boundary contracts
- `persistence`: file-backed store and coordinator
- `services`: registry, lifecycle, method, consent, dedup, merge, health, metrics, audit
- `runtime`: composition and singleton factory

## Runtime Composition
`createGenesisContactRuntime` composes:
- storage: `FileContactStore` -> `PersistenceCoordinator`
- state services: `ContactRegistry`, `ContactAuditWriter`, `ContactMetricsService`, `ContactHealthService`
- domain services: identity, method, affiliation, classification, preference, consent, eligibility, lifecycle, deduplication, merge
- dependency adapters: organization validation + platform health contributors

## Mission Control Surface
- Observability-only routes:
  - `src/app/api/gop/contact/health/route.ts`
  - `src/app/api/gop/contact/metrics/route.ts`
- GOP aggregate exposure:
  - `src/lib/gop/events-api.ts` includes contact metadata/metrics/health fields.

## Integrity Model
- Fail-closed load and mutation validation via `PersistenceCoordinator`.
- Tenant and organization validation during registration and recovery initialization.
- Cross-tenant protections for affiliations and merges.
