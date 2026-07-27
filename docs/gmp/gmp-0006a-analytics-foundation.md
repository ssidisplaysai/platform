# GMP-0006A Analytics Foundation v1.0

## Objective
Deliver the first additive analytics vertical slice for GMP with governed source registration, deterministic collection, normalized metrics, immutable snapshots, and measurement lineage.

## Scope
- Additive Prisma models for analytics source, capability, collection, observation, metric definition, normalized metric, performance snapshot, measurement lineage, and evidence compiler version.
- Placeholder registries reserved for attribution and recommendation features.
- Repository, service, adapter, API, and protected UI route scaffolding.
- Default-deny authorization integration with explicit analytics actions.

## Out of Scope
- GA4/GSC transport integration and external ingestion infrastructure.
- Attribution, recommendation, or autonomous optimization engines.
- Client-calculated analytics or dashboard intelligence beyond server-driven placeholders.

## Domain Contracts
- `GmpAnalyticsSource`: identity, provider/config references, status, collection mode, and health/collection timestamps.
- `GmpAnalyticsCollection`: run lifecycle plus eligibility report persistence.
- `GmpAnalyticsObservation`: raw adapter output records.
- `GmpMetricDefinition` and `GmpNormalizedMetric`: deterministic normalization boundary.
- `GmpPerformanceSnapshot`: immutable snapshot representation for historical performance views.
- `GmpMeasurementLineage`: collection/normalization/snapshot traceability.
- `GmpEvidenceCompilerVersion`: compiler-version provenance persisted per project.

## Authorization Actions
- `gmp:analytics:view`
- `gmp:analytics:manage_sources`
- `gmp:analytics:run_collection`
- `gmp:analytics:view_snapshots`
- `gmp:analytics:view_configuration`
- `gmp:analytics:manage_configuration`

## API Surface
- `GET /api/gmp/analytics/sources`
- `POST /api/gmp/analytics/sources`
- `GET /api/gmp/analytics/sources/[id]`
- `GET /api/gmp/analytics/sources/[id]/health`
- `GET /api/gmp/analytics/collections`
- `POST /api/gmp/analytics/collections`
- `GET /api/gmp/analytics/snapshots`
- `GET /api/gmp/analytics/snapshots/[id]`

## Protected Routes
- `/glw/projects/[id]/analytics`
- `/glw/projects/[id]/analytics/overview`
- `/glw/projects/[id]/analytics/sources`
- `/glw/projects/[id]/analytics/collections`
- `/glw/projects/[id]/analytics/performance`

## Determinism and Lineage
- Deterministic fixture adapter derives stable synthetic observations from source/window fingerprint.
- Collection eligibility is versioned (`gmp-analytics-eligibility/v1`).
- Normalization is versioned (`gmp-analytics-normalization/v1`).
- Snapshot lineage includes immutable snapshot metadata and hashed lineage fingerprints.
