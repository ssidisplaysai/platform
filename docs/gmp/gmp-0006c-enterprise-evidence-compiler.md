# GMP-0006C Enterprise Evidence Compiler v1.0

## Objective
Implement the Genesis Enterprise Evidence Compiler as an additive platform layer that transforms immutable analytics observations into governed, canonical, replayable marketing evidence.

## Scope
- Dedicated evidence compiler runtime with separated responsibilities:
  - `CompilerValidationService`
  - `ObservationNormalizationService`
  - `MetricCompilationService`
  - `PublicationCorrelationService`
  - `SnapshotCompilationService`
  - `EvidenceCompilerService` orchestration (`createGmpEvidenceServices`)
- Evidence-specific APIs under `/api/gmp/evidence/*`.
- Protected analytics workspace extension for evidence operations and review surfaces.
- Additive persistence for compiler runs, evidence snapshots, compiled metrics, and publication correlations.
- Expanded compiler version lineage in `GmpEvidenceCompilerVersion`.

## Out Of Scope
- Recommendation engines
- Attribution models
- AI optimization
- Autonomous publishing
- Budget optimization
- Predictive analytics
- Production Google OAuth redesign

## Compiler Architecture

Immutable Raw Observations
-> Observation Validation
-> Normalization
-> Canonical Metric Mapping
-> Publication Correlation
-> Data Quality Evaluation
-> Evidence Confidence Evaluation
-> Immutable Snapshot Compilation
-> Canonical Marketing Evidence

### Runtime Responsibilities
- `CompilerValidationService`
  - Required field checks
  - Duplicate identity checks
  - Timestamp validity checks
  - Collection lineage checks
  - Adapter version checks
  - Payload checksum evaluation
  - Supported-dimension and supported-metric evaluation
- `ObservationNormalizationService`
  - Provider-neutral transformation into canonical metric points
  - Non-mutating treatment of raw observations
- `MetricCompilationService`
  - Canonical metric catalog execution
  - Deterministic aggregation
  - Metric definition linkage and provisioning
- `PublicationCorrelationService`
  - Correlation against GMP-0005 publication records using canonical URL and publication identity
  - One-to-many observation relationship support
- `SnapshotCompilationService`
  - Deterministic snapshot payload serialization and checksum generation
- `EvidenceCompilerService`
  - End-to-end orchestration and immutable persistence

## Canonical Metric Catalog v1
- Organic Impressions (`organic_impressions`)
- Organic Clicks (`organic_clicks`)
- Organic CTR (`organic_ctr`)
- Average Position (`average_position`)
- Sessions (`sessions`)
- Users (`users`)
- Engaged Sessions (`engaged_sessions`)
- Engagement Time (`engagement_time`)
- Engagement Rate (`engagement_rate`)
- Conversions (`conversions`)

Each compiled metric stores:
- Canonical metric key and display contract
- Metric definition reference (`metricDefinitionId` when available)
- Compiler version
- Source observation ids
- Lineage fingerprint
- Data quality and confidence

## Data Quality And Confidence
### Data Quality Statuses
- `VALID`
- `PARTIAL`
- `STALE`
- `INVALID`
- `UNRESOLVED`
- `UNSUPPORTED`

### Evidence Confidence
- `HIGH`
- `MEDIUM`
- `LOW`
- `UNKNOWN`

Quality and confidence are computed separately.

## Snapshot Immutability And Replay
- Evidence snapshots are append-only (`GmpEvidenceSnapshot`).
- Recompilation creates a new snapshot row and a new compiler run.
- Deterministic replay uses identical input fingerprinting plus deterministic checksum comparison.
- Replay result surfaces `replayDeterministicMatch` when `replayOfRunId` is provided.

## Version Lineage
Compiler lineage tracked in `GmpEvidenceCompilerVersion` and copied into runs/snapshots:
- `compilerVersion`
- `normalizationVersion`
- `metricCatalogVersion`
- `correlationVersion`
- `snapshotVersion`
- `validationVersion`

## API Surface
- `GET /api/gmp/evidence/snapshots`
- `GET /api/gmp/evidence/snapshots/[id]`
- `GET /api/gmp/evidence/metrics`
- `GET /api/gmp/evidence/publications`
- `POST /api/gmp/evidence/recompile`

Operational support endpoints (workspace-facing):
- `GET /api/gmp/evidence/runs`
- `GET /api/gmp/evidence/catalog`

## Protected Workspace Extension
Extended analytics workspace modes:
- Evidence
- Evidence Snapshots
- Compiler Runs
- Correlation Review
- Metric Catalog

All rendered data is server-derived from repository-backed services.

## Authorization Actions
- `gmp:evidence:view`
- `gmp:evidence:view_snapshots`
- `gmp:evidence:view_compiler_runs`
- `gmp:evidence:run_compiler`
- `gmp:evidence:replay_compilation`
- `gmp:evidence:view_metric_catalog`

Default-deny policy remains in effect.

## Additive Persistence
Migration:
- `prisma/migrations/20260727150000_gmp_enterprise_evidence_compiler_v1/migration.sql`

Models introduced:
- `GmpEvidenceCompilerRun`
- `GmpEvidenceSnapshot`
- `GmpEvidenceCompiledMetric`
- `GmpEvidencePublicationReference`

Model expanded:
- `GmpEvidenceCompilerVersion` (component-version lineage columns)

## Known Limitations
- Workspace-wide `npx tsc --noEmit` continues to report pre-existing non-GMP-0006C TypeScript debt in unrelated runtime/template files.
- Compiler-quality/confidence heuristics are deterministic and governed, but still baseline v1 rules intended for further calibration in later packages.
