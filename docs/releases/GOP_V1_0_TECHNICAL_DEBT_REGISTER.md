# GOP v1.0 Technical Debt Register

## TD-001 Durable Queue Authority

Current active queue/lease control plane is process-local. Persisted projection exists but not yet authoritative for scheduler arbitration.

## TD-002 Cross-Host Lease Fencing

Need monotonic fencing tokens and stronger compare-and-set semantics for strict multi-host conflict immunity.

## TD-003 Worker Transport Optimization

Heartbeat + lease polling can be optimized with stream or long-poll protocols for large worker fleets.

## TD-004 Dead-letter Forensics

Operator notes and deep failure enrichment are modeled but not yet surfaced with advanced UI workflows.

## TD-005 Chaos Harness Expansion

Simulation tests are strong; full topology chaos under external DB/network degradation should be expanded.
