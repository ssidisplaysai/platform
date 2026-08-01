# Rule Classification

## Purpose
Define constitutional classes of rules and deterministic classification governance.

## Rule Type Classes
WS-IIID SHALL support deterministic handling for:
- Validation Rules
- Compliance Rules
- Classification Rules
- Identity Rules
- Relationship Rules
- Manufacturing Rules
- Commerce Rules
- Financial Rules
- Inventory Rules
- Scheduling Rules
- Security Rules
- Risk Rules
- Capability Rules
- Certification Rules
- Workflow Rules
- Temporal Rules
- Geographic Rules
- Regulatory Rules
- Industry Rules
- Company Rules
- Department Rules
- Custom Extension Rules

## Classification Governance
- Every rule SHALL map to one primary class.
- Multi-class applicability MAY be declared as secondary classes.
- Primary and secondary class declarations SHALL be versioned.
- Class definitions SHALL be immutable within a released version.

## Classification Determinism
Rule classification SHALL be deterministic and stable for a given rule identifier and version.

## Extension Policy
Custom Extension Rules MAY be added only through governance amendment and version increment.
