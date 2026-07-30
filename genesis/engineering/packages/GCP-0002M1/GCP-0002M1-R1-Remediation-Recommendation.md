# GCP-0002M1-R1 Remediation Recommendation

## Trigger
GCP-0002M1 concluded with blocking findings preventing transactional readiness.

## Recommended Package
GCP-0002M1-R1 split execution:
- GCP-0002M1-R1A - Authorization conformance remediation (completed)
- GCP-0002M1-R1B - Persistence and transactional-readiness remediation (pending)

## Required Remediation Scope
1. (Completed in R1A) Align collection/detail read APIs with declared permission policy and enforce strict auth + scope behavior.
2. (Completed in R1A) Add missing authorization regression tests for read endpoint conformance.
3. (Pending in R1B) Introduce durable repository strategy and transaction boundary plan required for quote-safe operations.
4. (Pending in R1B) Normalize readiness envelope reporting contract for cross-domain audit/reporting consistency (non-breaking adapter acceptable).
5. Revalidate scoped and repository-wide command matrix and update baseline classification evidence after each remediation stage.

## Out Of Scope
- Quote, order, invoice, payment, shipping, publishing, workflow, AI, and marketing execution capability implementation.

## Exit Criteria
- F001 closed and re-certified (achieved by R1A).
- F002 closed and re-certified (pending R1B).
- Freeze decision upgrade and transactional readiness upgrade remain blocked until R1B completion.
