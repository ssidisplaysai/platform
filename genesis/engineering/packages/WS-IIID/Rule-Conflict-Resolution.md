# Rule Conflict Resolution

## Purpose
Define deterministic governance for rule conflicts and incompatibilities.

## Conflict Domains
WS-IIID SHALL govern:
- Rule precedence
- Rule override governance
- Rule incompatibility
- Mutually exclusive rules
- Authority weighting
- Resolution governance

## Precedence Model
- Precedence SHALL be explicit and versioned.
- Higher-precedence rules SHALL be resolved first when conflict is detected.

## Override Governance
- Overrides SHALL require governance approval and rationale.
- Overrides SHALL be traceable to authority and version lineage.

## Incompatibility Handling
- Incompatible rules SHALL produce deterministic conflict outcomes.
- Conflict outcomes SHALL preserve both competing rule traces.

## Mutually Exclusive Rules
- Mutually exclusive constraints SHALL be explicitly declared.
- When exclusivity is violated, outcome SHALL be BLOCKED or CERTIFICATION HOLD according to governance policy.

## Authority Weighting
- Rule authorities SHALL carry governed weights.
- Weight schemas SHALL be versioned and auditable.

## Resolution Determinism
Given identical inputs, versions, and authority weights, conflict resolution outcomes SHALL be deterministic.
