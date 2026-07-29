# SPN Preliminary Lifecycle Model

## Partner Account Candidate States
- APPLICANT
- PENDING_REVIEW
- ACTIVE
- AT_RISK
- INACTIVE
- SUSPENDED
- ARCHIVED
- REJECTED

## Attribution Candidate States
- OBSERVED
- CANDIDATE
- RESOLVED
- LOCKED
- SUPERSEDED
- INVALIDATED

## Commission Candidate States
- ESTIMATED
- PENDING
- EARNED
- PAYABLE
- PAID
- REVERSED
- DISPUTED
- VOID

## Payout Candidate States
- REQUESTED
- VALIDATING
- APPROVED
- PROCESSING
- PAID
- FAILED
- CANCELED
- REVERSED

## Dispute Candidate States
- OPEN
- EVIDENCE_REQUESTED
- UNDER_REVIEW
- DECIDED
- APPEALED
- CLOSED

## Inactivity Policy (Preliminary)
- Days 0-59: ACTIVE
- Days 60-74: AT_RISK
- Days 75-89: REACTIVATION_WINDOW
- Day 90+: INACTIVE
- Extended inactivity: SUSPENDED or ARCHIVED by policy

## Inactivity Principles
- Identity retained.
- Ledger retained.
- Sponsor lineage retained.
- Partner IDs never recycled.
- QR and profile behavior policy-controlled.
- Territory and lead distribution may change by policy.
- Reactivation preserves canonical identity.

## Genesis Lifecycle Alignment Note
State names are preliminary and must be mapped to existing Genesis lifecycle semantics where canonical names differ.
