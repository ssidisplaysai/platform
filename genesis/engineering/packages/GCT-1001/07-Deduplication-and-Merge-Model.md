# 07 Deduplication and Merge Model

## Deduplication
Candidate scoring uses deterministic normalized signals:
- normalized email
- normalized phone
- identity link
- external identifier
- organization affiliation
- normalized name
- normalized postal address

Outputs contain explainable reasons and deterministic hash. Candidate detection is tenant-scoped and non-destructive.

## Merge
Merge requires explicit source and target with:
- same-tenant enforcement
- method conflict rejection
- source transition to `MERGED`
- target enrichment of methods, affiliations, preferences, consent, identity links, merge history
- idempotency by idempotency key

No autonomous/AI-driven merge action is implemented.
