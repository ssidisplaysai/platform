# Genesis Scientific Method

Genesis evolves through discovery, evidence, and verification.
No principle is canonical by opinion alone.

## Lifecycle

1. Observation
- Record a concrete phenomenon in business reality, architecture behavior, or compiler output.

2. Question
- Formulate the specific uncertainty or inconsistency to resolve.

3. Hypothesis
- Propose a testable explanation or principle candidate.

4. Evidence Collection
- Gather traceable evidence from sources, experiments, or audits.

5. Prototype
- Build a minimal representation or implementation to test the hypothesis.

6. Verification
- Validate outcomes against explicit acceptance criteria.

7. Discovery
- Register a discovery record with status, evidence, and impact.

8. Constitution Candidate
- Propose discovery promotion into first-principles doctrine.

9. Architecture Review
- Evaluate consistency with ADRs, system constraints, and platform invariants.

10. Implementation
- Apply approved principle into compiler/runtime/SDK design constraints.

11. Validation
- Confirm behavior in tests, audits, and operational outcomes.

12. Canonical Principle
- Promote only when evidence, review, and validation are complete.

## Proposal Requirements

A proposal must include:
- precise statement of claim
- scope and affected components
- expected impact and risks
- falsifiability criteria
- promotion target and required reviewers

## Evidence Requirements

Evidence submissions must include:
- source identity and provenance
- collection context and timestamp
- transformation lineage if processed
- reproducibility details for independent verification
- explicit mapping from evidence to claim

## Promotion Rules

A discovery may be promoted when:
- evidence is sufficient, traceable, and reproducible
- verification criteria have passed
- architecture review finds no unresolved conflicts
- implementation impact is understood and bounded
- validation confirms expected behavior

## Rejection Rules

A proposal is rejected when:
- evidence is missing, weak, or non-traceable
- hypothesis is non-falsifiable
- verification fails or is incomplete
- conflicts with existing canonical principles are unresolved
- operational risk is unbounded or unexplained

Rejected proposals remain in history with rationale.
They may be resubmitted only with new evidence or revised hypothesis.

## Relationship to ADRs and Compiler Implementation

- ADRs document architectural decisions and tradeoffs at implementation time.
- Genesis governance determines which discoveries are eligible to constrain ADRs.
- Compiler implementation must enforce promoted canonical principles as deterministic rules.
- Compiler changes cannot be justified by preference when they conflict with canonical doctrine.
