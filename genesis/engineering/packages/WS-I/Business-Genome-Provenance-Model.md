# Business Genome Provenance Model

## Provenance Mission
Define traceability contracts so every canonical fact is explainable from source evidence through governed transformations.

## Provenance Chain Segments
1. Source Origin
2. Evidence Capture
3. Normalization Step
4. Validation Step
5. Canonical Mapping Step
6. Approval Step
7. Current Active Version

## Provenance Attributes
- provenanceId
- originReference
- evidenceRef
- transformationChain
- approverRef
- approvalTimestamp
- governanceDecisionRef
- canonicalObjectRef
- canonicalVersion
- lineageHash

## Provenance Rules
1. Provenance is append-only.
2. Lineage hash changes when chain content changes.
3. Canonical activation requires provenance completeness.
4. Provenance must include approver and policy references.

## Provenance Auditability Requirements
- complete chain reconstruction for any active canonical object
- deterministic replay of mapping chain
- explicit policy reference per approval

## Cross-References
- Business-Genome-Evidence-Model.md
- Business-Genome-Versioning-Model.md
- Business-Genome-Invariants.md
