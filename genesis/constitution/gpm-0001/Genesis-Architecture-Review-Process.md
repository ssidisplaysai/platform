# Genesis Architecture Review Process

## Purpose
Standardize architecture review for all Genesis implementation packages.

## Review Steps
1. Intake Validation
- Confirm package references constitutional authority and GIA baseline.
- Confirm owner, dependencies, and target release window.

2. Architecture Boundary Review
- Verify ownership boundaries.
- Verify no prohibited governance modifications.
- Verify dependency impact mapping.

3. Determinism and Runtime Review
- Assess replay, lifecycle transitions, failover behavior, and isolation controls.

4. Evidence and Traceability Review
- Verify machine artifacts, traceability links, and evidence completeness.

5. Decision and Actions
- Decision: APPROVED, APPROVED WITH CONDITIONS, or REJECTED.
- Record conditions, remediation owners, and exit criteria.

## Required Participants
- Chief Architect (chair)
- Architecture Review Board
- Workstream Implementation Lead
- Quality Assurance
- Certification Authority
- Documentation Authority

## Output Requirements
- Architecture review record
- Condition register updates
- Dependency map updates
- Certification gate recommendation

## Review Rule
No implementation package may enter release approval without passing architecture review and evidence review.
