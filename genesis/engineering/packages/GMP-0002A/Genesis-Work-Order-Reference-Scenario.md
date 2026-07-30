# Genesis Work Order Reference Scenario

## Deterministic End-to-End Scenario
1. Retrieve a valid approved sales order in organization scope.
2. Create a work order from the sales order through from-order conversion.
3. Verify lineage fields contain source sales order and quote references.
4. Verify initial audit and published creation event records.
5. Update draft work order fields with expected version behavior.
6. Create controlled revision entry with reason and changed fields.
7. Attempt release from invalid state and verify deterministic rejection.
8. Execute valid planning and release transitions.
9. Inspect timeline and audit continuity for revision and lifecycle entries.
10. Execute search by work-order number, sales order, quote, and status criteria.
11. Verify enterprise event envelopes include contract version, aggregate identity, and causation metadata.
12. Trigger rejected mutation and verify no partial state advancement.
13. Confirm no Production Job or downstream execution activity is invoked.

## Evidence Mapping
- Behavior and API coverage: work-order foundation and API test suites
- Boundary enforcement: prohibited-capability scan
- Lint and diagnostics: scoped quality gates

## Scenario Result
- Status: PASS
