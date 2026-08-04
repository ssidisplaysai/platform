# 08 Persistence and Recovery

Persistence model:

- file-backed state at data/documents/document-state.v1.json
- lock-guarded load/save for deterministic writes

State coverage:

- documents
- templates
- revisions
- approvals
- signatures
- lifecycle
- relationships
- asset references
- audits
- metrics

Recovery model:

- schema compatibility validation (1.0.0)
- referential integrity validation
- corruption detection counters
- fail-closed recovery behavior
