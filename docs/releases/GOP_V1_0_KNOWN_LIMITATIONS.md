# GOP v1.0 Known Limitations

## Runtime Fabric Persistence Depth

Lease/dead-letter data models are defined in Prisma, but runtime queue state remains primarily in-process for active scheduling decisions.

## Multi-host Lease Fencing

Lease expiration and reassignment are deterministic, but strong cross-host fencing tokens are not yet implemented.

## Worker Transport Efficiency

Current protocol uses request/response heartbeat and lease calls. Long-lived transport optimization is deferred.

## Chaos Coverage Scope

Certification includes deterministic simulation tests; full multi-host partition chaos in production-like environments is deferred.

## TypeScript Global Validation

Focused TypeScript diagnostics are clean for GOP surfaces. Full-repo noEmit remains sensitive to unrelated non-GOP template placeholders.
