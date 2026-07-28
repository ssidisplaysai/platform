# 04 Responsibility Ownership Matrix

## Matrix

| Concern | Owns | Defines | Implements | Governs | Validates | Consumes | Extends | Must Not Modify |
|---|---|---|---|---|---|---|---|---|
| Runtime execution lifecycle | Runtime Foundation | GRT-0010/GRT-0015 | marketing-engine/runtime | Architecture Governance | Runtime certification artifacts | Kernels, adapters | Runtime extension points | Kernel/domain packages |
| Kernel inheritance invariants | GKF | GKF package artifacts | Kernel implementations | Architecture + Engineering Governance | Conformance/certification packages | Kernel programs | Approved kernel extensions | Runtime authority surface |
| Constitutional services contract | Constitutional Services (named) | GCS-0001 | Compiler/service implementations | Governance artifacts | Package validation artifacts | GBGF, GCDM, GBG chain | Controlled service evolution | Downstream packages redefining service authority |
| Business genome foundation boundaries | GBGF | GBGF-0001 | GBG families | Architecture + Engineering Governance | Completion/certification chains | GBG downstream | Additive package model | Application/domain ad-hoc overrides |
| Canonical data semantics | GCDM | GCDM-0001 | Downstream semantic consumers | Architecture + Engineering Governance | GCDM completion artifacts | GBGF, applications | Additive model extensions | Runtime execution layer |
| Certification/freeze/release policy | Governance standards | GRS-0001 | Governance process, not runtime code | Architecture Council + Release Authority | Certification packages | All programs | Policy amendments via approval | Unapproved packages |
| Artifact registry and manifest | Architecture Manifest authority | ARCHITECTURE_MANIFEST.md | Documentation updates | Architecture Governance | Link/ID checks, package reports | Entire platform | Additive registrations | Historical disposition rewrites |
| Decision process | Architecture/Governance boards | decisions.md and ADR process docs | Documentation process | Governance framework | Review packages | All programs | New ADRs | Informal summaries replacing ADRs |

## Responsibility Findings
- No zero-owner critical concern was found.
- One major governance clarity defect exists: Constitutional Services ownership is named in many package artifacts but is not represented as first-class registry family rows in ARCHITECTURE_MANIFEST.

## Result
MAJOR finding recorded (FR-001).