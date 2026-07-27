# GBA-0005A Performance Report

## Benchmark Method
Runtime micro-benchmarks executed against in-memory Sales repository with seeded runtime state.

Iterations per operation: 10

## Results (ms)
1. Dashboard rendering
- avg: 3.646
- min: 1.691
- max: 10.084

2. Opportunity retrieval
- avg: 0.007
- min: 0.001
- max: 0.051

3. Pipeline summaries
- avg: 0.002
- min: 0.001
- max: 0.011

4. Forecast calculations
- avg: 0.010
- min: 0.001
- max: 0.090

5. KPI calculations (dashboard metric synthesis)
- avg: 2.202
- min: 1.406
- max: 2.868

6. Recommendation generation
- avg: 0.021
- min: 0.002
- max: 0.169

7. Health endpoint performance
- avg: 1.952
- min: 1.040
- max: 2.562

## Assessment
All measured Sales runtime operations complete in low-latency range under certification probe conditions.

Observation:
- Benchmarks are runtime micro-benchmarks, not full end-to-end networked load tests.
