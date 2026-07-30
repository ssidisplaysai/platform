# GPC-0001A-05 Performance Acceptance Criteria

Program: GPC-0001  
Work package: GPC-0001A-05  
Date: 2026-07-29

## 1. Acceptance Model

Criteria in this package are defined as:
1. Defined (repository-backed objective exists), or
2. Deferred with external evidence requirement.

No benchmark value is invented where repository evidence is absent.

## 2. Performance Acceptance Criteria

| Criterion ID | Criterion | Evidence Basis | Status |
|---|---|---|---|
| A05-AC-01 | Critical services have documented performance objectives | A-05 strategy service objective matrix | Defined |
| A05-AC-02 | Capacity assumptions are documented | A-05 capacity assumptions matrix | Defined |
| A05-AC-03 | Scalability assumptions are documented | A-05 scalability assessment | Defined |
| A05-AC-04 | Performance verification strategy exists | A-05 verification and test strategy docs | Defined |
| A05-AC-05 | Load, stress, soak test approaches are documented | A-05 load and stress plan | Defined |
| A05-AC-06 | Queue and worker performance signals are measurable in-repo | queue-manager + worker-registry metrics and load logic | Defined |
| A05-AC-07 | API and job processing performance signals are measurable in-repo | GOP metrics + GLW dashboard metrics | Defined |
| A05-AC-08 | Numeric production thresholds and attainment evidence are available | External telemetry and run-history evidence | Deferred with evidence |
| A05-AC-09 | External performance telemetry is tracked in Production Evidence Register | Master register updated with performance evidence IDs | Defined |

## 3. Explicit Deferrals

Deferred items pending external evidence:
1. Production p95/p99 latency targets.
2. Throughput saturation points and max sustained TPS.
3. DB engine-level performance analytics and capacity thresholds.
4. Infrastructure CPU/memory/network utilization thresholds.
5. Long-duration soak pass/fail performance records.

## 4. Acceptance Decision Rule

1. Package may be approved with conditions if all required performance controls are documented and all missing telemetry is explicitly tracked in the master register.
2. Package cannot be unconditionally certified until deferred external evidence is verified.
