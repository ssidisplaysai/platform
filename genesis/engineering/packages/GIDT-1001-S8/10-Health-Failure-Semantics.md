# 10 Health Failure Semantics

Deterministic semantics applied:
- missing mandatory product validator => UNHEALTHY
- missing optional validator => DEGRADED
- quantity invariant failure => UNHEALTHY
- ledger integrity failure => UNHEALTHY
- duplicate/invalid serial integrity => UNHEALTHY
- repeated concurrency conflict => DEGRADED or UNHEALTHY thresholded
- audit sink unavailable => UNHEALTHY
- observation sink unavailable => DEGRADED/UNHEALTHY by required check
- runtime partial initialization => UNHEALTHY
- lifecycle stop failure => DEGRADED recovery signal
