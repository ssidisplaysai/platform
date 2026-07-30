# Genesis Operation Reference Scenario

Scenario:
1. Create a Production Job under authorized organization scope.
2. Create an Operation from that Production Job.
3. Define, ready, release, wait, complete, and close the Operation.
4. Verify lineage, revision history, audit trail, timeline, and search visibility.

Expected outcome:
- The Operation record remains lineage-complete and immutable where required.
- Invalid terminal transitions are rejected.
- No execution capability is exposed.

Result: PASS