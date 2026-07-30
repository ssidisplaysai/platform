# Genesis Production Job Reference Scenario

## Deterministic End-to-End Scenario
1. Retrieve a valid released Work Order.
2. Create a Production Job from the Work Order.
3. Verify Work Order, Sales Order, and Quote lineage.
4. Verify initial audit and published creation event records.
5. Update the Production Job while in Draft.
6. Verify controlled revision history.
7. Move the Production Job through valid pre-execution lifecycle states.
8. Release the Production Job.
9. Start, pause, and resume only where implemented and authorized.
10. Inspect timeline and audit continuity.
11. Search by Production Job number, Work Order, Sales Order, Quote, and status.
12. Verify enterprise event envelopes.
13. Trigger a rejected mutation and confirm rollback safety.
14. Verify the parent Work Order remains unchanged.
15. Confirm no operation or downstream execution is created.

## Evidence Mapping
- Behavior and API coverage: production-job foundation and API test suites
- Compatibility: GMP-0002 regression suites
- Boundary enforcement: prohibited-capability scan
- Lint and diagnostics: scoped quality gates

## Scenario Result
- Status: PASS
