# 04 Deduplication and Merge Assessment

Assessment outcome: PASS with condition C1

Deduplication:

- Deterministic weighted scoring across normalized email, phone, identity links, external identifiers, affiliations, names, and postal signals.
- Candidate list sorted deterministically by score and contactId.
- Tenant-scoped candidate evaluation prevents cross-tenant matching.

Merge:

- Same-tenant enforcement is explicit.
- Conflicting normalized method keys prevent unsafe merge.
- Merge preserves methods, affiliations, preferences, consent history, identity links, and merge history.
- Source contact is marked MERGED with mergedIntoContactId.
- Idempotency key support exists.

Condition note (C1):

- Idempotency cache is in-memory only, so restart can lose key history and allow duplicate merge execution on replay.
- Severity: MEDIUM
- Blocking for certification: No

Conclusion:

- Dedup and merge mechanics are strong and test-backed for engineering scope; durable idempotency is required for higher operational assurance.
