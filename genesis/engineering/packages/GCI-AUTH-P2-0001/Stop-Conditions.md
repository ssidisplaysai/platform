# Stop Conditions

## Immediate Stop Triggers
- Any attempt to create canonical entities.
- Any attempt to create canonical relationships.
- Any attempt to evaluate business rules.
- Any attempt to assemble Business Genome outputs.
- Any introduction of persistence, scheduling, orchestration, AI, OCR, crawler, queue, worker, or deployment concerns.

## Governance Stop Triggers
- Missing deterministic behavior evidence.
- Missing lineage/provenance linkage.
- Forbidden dependency import detected.
- Unapproved scope expansion.
- Failed independent certification domain.

## Stop Procedure
1. Halt implementation activity.
2. Record violation in governance incident log.
3. Produce corrective action proposal.
4. Re-open only after explicit governance approval.