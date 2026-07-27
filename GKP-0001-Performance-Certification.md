# GKP-0001 - Performance Certification Report

Status: PASS
Date: 2026-07-27

## Objective
Provide reproducible benchmark evidence for runtime throughput, replay behavior, and operational latency signals.

## Benchmark Methodology
- Script: scripts/gop-v1-cert-benchmark.mts
- Command: npx tsx scripts/gop-v1-cert-benchmark.mts
- Environment: local development runtime, in-memory execution repository benchmark model
- Worker scales tested: 10, 100, 500, 1000

## Benchmark Results
| Workers | Dispatch Count | Dispatch Duration (ms) | Dispatch/sec | Dispatch p50 (ms) | Dispatch p95 (ms) | Replay Duration (ms) | Recovery Duration (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| 10 | 10 | 12.42 | 805.17 | 17 | 18 | 4.31 | 0.86 |
| 100 | 100 | 29.74 | 3362.68 | 23 | 35 | 3.81 | 0.97 |
| 500 | 500 | 493.84 | 1012.48 | 281 | 486 | 10.39 | 5.89 |
| 1000 | 1000 | 2120.06 | 471.68 | 1112 | 2053 | 40.27 | 10.27 |

## Interpretation
- Throughput and dispatch behavior remain deterministic and stable for the benchmark profile.
- Latency increases at larger scale are consistent with single-process simulation characteristics.
- Replay and recovery remain bounded and reproducible.

## Findings
- Blocker: None
- Major: None
- Minor: None
- Observation: Results are benchmark-simulation evidence, not production cluster saturation testing.

## Conclusion
Performance certification is PASS for platform readiness baseline.
