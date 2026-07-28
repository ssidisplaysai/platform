# Genesis Audit Traceability Standard

## Mandatory Traceability Relationships
Every audit package shall define links between:
- Audit and Evidence
- Audit and Findings
- Audit and Standards
- Audit and Procedures
- Audit and Certification Inputs
- Audit and Repository Artifacts
- Audit and Machine Identifiers
- Audit and Lifecycle Identifiers

## Traceability Rules
1. Every finding must reference at least one evidence record.
2. Every evidence record must map to at least one input source.
3. Every report must reference governing standards and procedures.
4. Certification input packages must retain full audit-to-evidence-to-finding linkage.

## Machine Reference
- [machine/evidence-bindings.schema.json](machine/evidence-bindings.schema.json)
- [machine/audit-registry.schema.json](machine/audit-registry.schema.json)