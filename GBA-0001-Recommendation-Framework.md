# GBA-0001 Recommendation Framework

## Scope
Deterministic recommendation generation, review lifecycle, and approval capture for executive decisions.

## Recommendation Contracts
- category
- title
- summary
- evidence references
- business impact
- confidence
- required approvals
- suggested owner
- priority
- deterministic checksum
- immutable lineage

## Determinism
- Recommendation payloads are canonicalized before hashing.
- `deterministicChecksum` is stable for identical semantic input.
- Immutable lineage stores replay-compatible checksum material.

## Review Lifecycle
- Review endpoint accepts decisions:
  - `APPROVED`
  - `REJECTED`
- Review records are persisted separately from recommendation records.
- Recommendation review emits timeline and approval records.

## Persistence
- `GbaExecutiveRecommendation`
- `GbaExecutiveRecommendationReview`
- `GbaExecutiveApproval`
- `GbaExecutiveTimelineEvent`

## Authorization
- View: `gba:executive:view_recommendations`
- Review: `gba:executive:review_recommendations`
