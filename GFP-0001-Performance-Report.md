# GFP-0001 - Performance Report

Status: PASS
Date: 2026-07-27

## Objective
Measure runtime and compiler performance for platform certification evidence.

## Benchmark Evidence
- `npx tsx scripts/gop-v1-cert-benchmark.mts`
- Result: PASS; benchmark rows captured for 10, 100, 500, 1000 worker scenarios.

### Selected Metrics
- 10 workers:
  - dispatchPerSec: 681.48
  - throughputPerMinute: 610
  - replayDurationMs: 4.3
- 100 workers:
  - dispatchPerSec: 3944.35
  - throughputPerMinute: 700
  - replayDurationMs: 2.11
- 500 workers:
  - dispatchPerSec: 1098.06
  - throughputPerMinute: 3500
  - replayDurationMs: 10.4
- 1000 workers:
  - dispatchPerSec: 565.93
  - throughputPerMinute: 7000
  - replayDurationMs: 27.22

## Compiler Performance Evidence
- `npx tsx --test tests/compiler/discovery/performance-validation.test.ts`
- Result: PASS (deterministic large filesystem ingestion check)

## Conclusion
Performance certification is PASS for baseline readiness and reproducibility.
