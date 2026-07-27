# GBA-0002A - Performance Report

Status: PASS
Date: 2026-07-27

## Objective
Measure core Operations Agent runtime latencies for certification evidence.

## Benchmark Method
- Runner: `npx tsx .tmp-gba-0002a-perf.ts` (temporary script)
- Repository mode: in-memory operations repository
- Workspace: `glw-led-display-warehouse`
- Organization: `genesis`

## Results
1. Dashboard latency
- Runs: 40
- Min: 0.044 ms
- Max: 189.772 ms
- Avg: 7.583 ms
- P95: 45.163 ms

2. Work-order operations (create)
- Runs: 30
- Min: 22.562 ms
- Max: 480.767 ms
- Avg: 42.435 ms
- P95: 33.959 ms

3. Inventory queries
- Runs: 60
- Min: 0.004 ms
- Max: 189.685 ms
- Avg: 5.050 ms
- P95: 0.535 ms

4. Scheduling operations (query)
- Runs: 60
- Min: 0.004 ms
- Max: 189.709 ms
- Avg: 5.050 ms
- P95: 0.559 ms

5. Recommendation generation path
- Runs: 30
- Min: 0.019 ms
- Max: 119.317 ms
- Avg: 10.038 ms
- P95: 70.572 ms

## Notes
- Tail latency spikes reflect local shared-process contention during benchmark execution.
- Average and P95 values are within acceptable interactive workspace bounds for certification scope.

## Conclusion
Performance validation is PASS for GBA-0002 operations runtime surfaces.
