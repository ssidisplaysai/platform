# Genesis Repository Sanitation Report

## Package
- Program: Genesis Enterprise Architecture
- Package: GARS-0001
- Title: Genesis Pre-Audit Repository Sanitation & Baseline Finalization

## Scope
Repository sanitation only. No architecture, runtime, Business Agent, or feature behavior modifications were introduced.

## Files Reviewed (Evidence Set)
1. .tmp-gba0006a-replay-perf.ts
2. .tmp-ged-cert-performance.ts
3. .tmp-ged-cert-replay.ts
4. .tmp-ged0004-benchmark.ts
5. .tmp-ged0004-replay.ts
6. .tmp-glw-monitor-fixrun.ts
7. .vscode/settings.json
8. db-backup-20260726-130057.dump
9. db-backup-20260726-130103.dump

## Decision Matrix

| File | Purpose | Required by Genesis runtime | Temporary/Generated/Local | Sensitive risk | Decision | Reasoning |
|---|---|---|---|---|---|---|
| .tmp-gba0006a-replay-perf.ts | Finance replay/performance certification harness | No | Temporary engineering script | Low | Relocated | Useful reusable benchmark/replay logic retained under scripts/certification |
| .tmp-ged-cert-performance.ts | GED performance harness | No | Temporary engineering script | Low | Relocated | Reusable certification benchmark preserved |
| .tmp-ged-cert-replay.ts | GED deterministic replay harness | No | Temporary engineering script | Low | Relocated | Reusable deterministic replay validation preserved |
| .tmp-ged0004-benchmark.ts | Marketing benchmark harness | No | Temporary engineering script | Low | Relocated | Reusable benchmark logic preserved |
| .tmp-ged0004-replay.ts | Marketing replay determinism harness | No | Temporary engineering script | Low | Relocated | Reusable replay check preserved |
| .tmp-glw-monitor-fixrun.ts | GLW job monitor script for one-off investigation | No | Temporary engineering script | Medium (job payload/error visibility) | Relocated and generalized | Preserved as operational utility with parameterized job id and timeout |
| .vscode/settings.json | VS Code workspace setting (chat agent request cap) | No | Local IDE configuration | Low | Removed | Machine/editor-local preference not required for shared baseline |
| db-backup-20260726-130057.dump | PostgreSQL backup artifact (0-byte, invalid) | No | Generated backup artifact | Unknown | Removed | Not usable and not constitutionally required in repository |
| db-backup-20260726-130103.dump | PostgreSQL custom-format backup with table data | No | Generated backup artifact | High potential (contains table data) | Removed | Repository baseline should not version mutable backup data |

## Files Relocated
1. .tmp-gba0006a-replay-perf.ts -> scripts/certification/gba0006a-finance-replay-performance.mts
2. .tmp-ged-cert-performance.ts -> scripts/certification/ged-cert-performance.mts
3. .tmp-ged-cert-replay.ts -> scripts/certification/ged-cert-replay.mts
4. .tmp-ged0004-benchmark.ts -> scripts/certification/gba0004-marketing-benchmark.mts
5. .tmp-ged0004-replay.ts -> scripts/certification/gba0004-marketing-replay.mts
6. .tmp-glw-monitor-fixrun.ts -> scripts/operations/glw-monitor-job-fixrun.mts

## Files Removed From Tracking
1. .tmp-gba0006a-replay-perf.ts
2. .tmp-ged-cert-performance.ts
3. .tmp-ged-cert-replay.ts
4. .tmp-ged0004-benchmark.ts
5. .tmp-ged0004-replay.ts
6. .tmp-glw-monitor-fixrun.ts
7. .vscode/settings.json
8. db-backup-20260726-130057.dump
9. db-backup-20260726-130103.dump

## Dump Inspection Findings
- db-backup-20260726-130057.dump: file too short, empty/invalid archive.
- db-backup-20260726-130103.dump: PostgreSQL custom dump with TABLE DATA entries for GlwJob, GopJobEvent, and _prisma_migrations.
- Conclusion: dump artifacts are environment-generated and not suitable for permanent audit baseline tracking.

## .gitignore Changes
Added prevention rules for accidental recommit of sanitation artifacts:
1. /.tmp-*.ts
2. /db-backup-*.dump
3. /.vscode/

## Retained Evidence Artifacts
- Existing architecture and certification artifacts were retained.
- Reusable validation scripts were retained in permanent script locations.

## Baseline Accuracy Review
- Genesis-Pre-Audit-Baseline.md remains an accurate historical record for v1.0 baseline state.
- v1.1 final baseline is recorded separately in Genesis-Pre-Audit-Baseline-v1.1.md.
