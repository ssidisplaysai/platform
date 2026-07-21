# GCSOC-0001

Title: Constitutional Service Operation Catalog
Status: Draft
Authority: Foundation Authority
Parent: GCSA-0003
Review Target: GAR-0044

## 1. Purpose

This catalog defines the minimum authoritative constitutional service operation inventory derived from the approved capability inventory in GCSA-0002.

This artifact defines inventory entries only. It does not define full operation contracts, composition contracts, or dependency graph topology.

## 2. Derivation Method

Derivation constraints applied:
- each approved capability was reviewed as an independent constitutional behavior unit
- the smallest independently governable operation was derived from each capability
- exactly one owning service was assigned to each operation, inherited from capability ownership
- operation reuse was permitted only when behavior, authority, outcome, and failure semantics were identical
- no capability was decomposed into implementation steps
- no operation unsupported by GCSA-0002 was introduced
- unresolved ambiguity was required to be recorded as an explicit gap

Derivation result:
- minimum authoritative inventory is one-to-one with approved capability inventory
- no cross-capability operation reuse satisfied strict identity conditions

## 3. Minimum Authoritative Operation Inventory

Lifecycle Status legend:
- Defined

Stability Classification legend:
- Baseline-Candidate

Definition Status legend:
- Inventory-Derived (Contract Pending)

| Operation ID | Canonical Operation Name | Owning Service | Realized Capability ID | Realized Capability Name | Constitutional Outcome | Lifecycle Status | Stability Classification | Definition Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GCSO-OP-REG-001 | Artifact Registration Operation | Constitutional Registry Service | GCSA-CAP-REG-001 | Artifact Registration | Artifact gains governed registry standing and addressability. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-REG-002 | Artifact Discovery Operation | Constitutional Registry Service | GCSA-CAP-REG-002 | Artifact Discovery | Governed artifact discovery result set is produced from approved criteria. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-REG-003 | Artifact Lookup Operation | Constitutional Registry Service | GCSA-CAP-REG-003 | Artifact Lookup | Specific artifact standing context is resolved or explicitly unresolved. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-REG-004 | Identity Resolution Operation | Constitutional Registry Service | GCSA-CAP-REG-004 | Identity Resolution | Canonical constitutional identity is resolved with ambiguity surfaced explicitly. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-REG-005 | Authority Resolution Operation | Constitutional Registry Service | GCSA-CAP-REG-005 | Authority Resolution | Constitutional authority placement is resolved for downstream governance checks. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-REG-006 | Dependency Lookup Operation | Constitutional Registry Service | GCSA-CAP-REG-006 | Dependency Lookup | Declared dependency context is retrieved without semantic reinterpretation. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-REG-007 | Registry Navigation Operation | Constitutional Registry Service | GCSA-CAP-REG-007 | Registry Navigation | Governed relationship path context is navigated from a valid registry entry point. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-PUB-001 | Publication Planning Operation | Publication Service | GCSA-CAP-PUB-001 | Publication Planning | Publication pathway readiness is determined with prerequisite gate status. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-PUB-002 | Manifest Generation Operation | Publication Service | GCSA-CAP-PUB-002 | Manifest Generation | Publication manifest context is generated in lineage alignment with standing. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-PUB-003 | Publication Assembly Operation | Publication Service | GCSA-CAP-PUB-003 | Publication Assembly | Publication-ready governed artifact assembly context is produced or blocked. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-PUB-004 | Publication Synchronization Operation | Publication Service | GCSA-CAP-PUB-004 | Publication Synchronization | Publication standing is synchronized across registry and index surfaces. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-PUB-005 | Publication Verification Operation | Publication Service | GCSA-CAP-PUB-005 | Publication Verification | Publication sufficiency is verified and progression is either allowed or blocked. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-PUB-006 | Publication Index Management Operation | Publication Service | GCSA-CAP-PUB-006 | Publication Index Management | Publication-facing index standing remains coherent with publication truth. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-VAL-001 | Structural Validation Operation | Validation Service | GCSA-CAP-VAL-001 | Structural Validation | Structural coherence status is determined against governed relationship rules. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-VAL-002 | Metadata Validation Operation | Validation Service | GCSA-CAP-VAL-002 | Metadata Validation | Metadata conformance status is determined against constitutional rules. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-VAL-003 | Lifecycle Validation Operation | Validation Service | GCSA-CAP-VAL-003 | Lifecycle Validation | Lifecycle state and transition legitimacy are determined. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-VAL-004 | Dependency Conformance Validation Operation | Validation Service | GCSA-CAP-VAL-004 | Dependency Validation | Dependency conformance to directionality and legitimacy constraints is determined. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-VAL-005 | Policy Validation Operation | Validation Service | GCSA-CAP-VAL-005 | Policy Validation | Constitutional policy conformance status is determined. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-VAL-006 | Referential Integrity Validation Operation | Validation Service | GCSA-CAP-VAL-006 | Referential Integrity Validation | Cross-artifact reference integrity status is determined with unresolved references surfaced. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-CERT-001 | Certification Assessment Operation | Certification Service | GCSA-CAP-CERT-001 | Certification Assessment | Certification readiness sufficiency status is determined from evidence context. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-CERT-002 | Certification Recommendation Operation | Certification Service | GCSA-CAP-CERT-002 | Certification Recommendation | Certification recommendation is produced from assessment outcomes. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-CERT-003 | Certification Approval Operation | Certification Service | GCSA-CAP-CERT-003 | Certification Approval | Certification approval state is authoritatively established under governance. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-CERT-004 | Certification Recording Operation | Certification Service | GCSA-CAP-CERT-004 | Certification Recording | Certification decision and evidence references become governed recorded standing. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-CERT-005 | Certification State Management Operation | Certification Service | GCSA-CAP-CERT-005 | Certification State Management | Certification lifecycle state coherence is maintained across valid transitions. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-REV-001 | Architecture Review Operation | Review Service | GCSA-CAP-REV-001 | Architecture Review | Architecture review disposition is produced with boundary integrity findings. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-REV-002 | Engineering Review Operation | Review Service | GCSA-CAP-REV-002 | Engineering Review | Engineering readiness disposition is produced with evidence-based findings. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-REV-003 | Governance Review Operation | Review Service | GCSA-CAP-REV-003 | Governance Review | Governance legitimacy and authority compliance disposition is produced. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-REV-004 | Publication Review Operation | Review Service | GCSA-CAP-REV-004 | Publication Review | Publication integrity and readiness disposition is produced. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-REV-005 | Review Coordination Operation | Review Service | GCSA-CAP-REV-005 | Review Coordination | Required review classes are sequenced into coherent review progression state. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-REV-006 | Review Recommendation Operation | Review Service | GCSA-CAP-REV-006 | Review Recommendation | Unified review recommendation is produced from coordinated review outcomes. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-AUD-001 | Repository Audit Operation | Audit Service | GCSA-CAP-AUD-001 | Repository Audit | Repository discoverability and structural truth sufficiency status is determined. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-AUD-002 | Governance Audit Operation | Audit Service | GCSA-CAP-AUD-002 | Governance Audit | Governance alignment and authority conformance status is determined. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-AUD-003 | Publication Audit Operation | Audit Service | GCSA-CAP-AUD-003 | Publication Audit | Publication coherence and traceability sufficiency status is determined. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-AUD-004 | Consistency Audit Operation | Audit Service | GCSA-CAP-AUD-004 | Consistency Audit | Cross-surface consistency status is determined and drift is surfaced. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-AUD-005 | Compliance Audit Operation | Audit Service | GCSA-CAP-AUD-005 | Compliance Audit | Constitutional invariant and governance compliance status is determined. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-AUD-006 | Audit Reporting Operation | Audit Service | GCSA-CAP-AUD-006 | Audit Reporting | Audit findings are emitted as governed reporting context for decisions. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-TRC-001 | Provenance Resolution Operation | Traceability Service | GCSA-CAP-TRC-001 | Provenance Resolution | Provenance path context is resolved or explicitly unresolved. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-TRC-002 | Lineage Resolution Operation | Traceability Service | GCSA-CAP-TRC-002 | Lineage Resolution | Lineage continuity context is resolved across governed predecessor-successor paths. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-TRC-003 | Cross-Reference Resolution Operation | Traceability Service | GCSA-CAP-TRC-003 | Cross-Reference Resolution | Cross-reference relationship context is resolved with unresolved references surfaced. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-TRC-004 | Relationship Navigation Operation | Traceability Service | GCSA-CAP-TRC-004 | Relationship Navigation | Governed artifact relationship route context is produced. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-TRC-005 | Impact Analysis Operation | Traceability Service | GCSA-CAP-TRC-005 | Impact Analysis | Traceable downstream impact scope context is determined for a change trigger. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-TRC-006 | Trace Graph Construction Operation | Traceability Service | GCSA-CAP-TRC-006 | Trace Graph Construction | Governance trace graph context is assembled from provenance, lineage, and references. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-REL-001 | Release Planning Operation | Release Service | GCSA-CAP-REL-001 | Release Planning | Release scope and readiness path context is determined. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-REL-002 | Release Assembly Operation | Release Service | GCSA-CAP-REL-002 | Release Assembly | Release baseline artifact assembly context is produced or blocked. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-REL-003 | Freeze Coordination Operation | Release Service | GCSA-CAP-REL-003 | Freeze Coordination | Freeze alignment status is determined from release and certification sufficiency context. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-REL-004 | Release Manifest Management Operation | Release Service | GCSA-CAP-REL-004 | Release Manifest Management | Release-level manifest context remains coherent with release lineage. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-REL-005 | Release Publication Coordination Operation | Release Service | GCSA-CAP-REL-005 | Release Publication Coordination | Final release publication transition path is coordinated under governance gates. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-REL-006 | Release Verification Operation | Release Service | GCSA-CAP-REL-006 | Release Verification | Release sufficiency and baseline integrity status is determined. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-MET-001 | Metadata Registration Operation | Metadata Service | GCSA-CAP-MET-001 | Metadata Registration | Governed metadata context is associated with artifact standing. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-MET-002 | Metadata Normalization Operation | Metadata Service | GCSA-CAP-MET-002 | Metadata Normalization | Metadata context is normalized while preserving constitutional meaning. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-MET-003 | Metadata Evolution Operation | Metadata Service | GCSA-CAP-MET-003 | Metadata Evolution | Metadata evolution path remains governance-compliant with continuity preserved. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-MET-004 | Metadata Compatibility Operation | Metadata Service | GCSA-CAP-MET-004 | Metadata Compatibility | Metadata compatibility status is determined across governed standing surfaces. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-MET-005 | Metadata Query Operation | Metadata Service | GCSA-CAP-MET-005 | Metadata Query | Governed metadata retrieval results are produced from approved criteria. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-MET-006 | Metadata Governance Operation | Metadata Service | GCSA-CAP-MET-006 | Metadata Governance | Metadata stewardship governance constraints are applied and status is determined. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-DEP-001 | Dependency Graph Construction Operation | Dependency Resolution Service | GCSA-CAP-DEP-001 | Dependency Graph Construction | Dependency graph context is constructed from governed declarations and authority context. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-DEP-002 | Dependency Resolution Operation | Dependency Resolution Service | GCSA-CAP-DEP-002 | Dependency Resolution | Dependency path context is resolved or explicitly unresolved with cause. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-DEP-003 | Dependency Legitimacy Validation Operation | Dependency Resolution Service | GCSA-CAP-DEP-003 | Dependency Validation | Dependency legitimacy status is determined against authority and governance rules. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-DEP-004 | Circular Dependency Detection Operation | Dependency Resolution Service | GCSA-CAP-DEP-004 | Circular Dependency Detection | Circular dependency condition status is determined and surfaced. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-DEP-005 | Dependency Ordering Operation | Dependency Resolution Service | GCSA-CAP-DEP-005 | Dependency Ordering | Dependency-respecting order context is determined from resolved valid dependencies. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |
| GCSO-OP-DEP-006 | Dependency Impact Analysis Operation | Dependency Resolution Service | GCSA-CAP-DEP-006 | Dependency Impact Analysis | Dependency impact propagation context is determined for a change trigger. | Defined | Baseline-Candidate | Inventory-Derived (Contract Pending) |

## 4. Validation Summary

- total services reviewed: 10
- total capabilities reviewed: 60
- total operations derived: 60
- capabilities mapped one-to-one: 60
- capabilities mapped one-to-many: 0
- operations shared across capabilities: 0
- unresolved gaps: 0
- ownership conflicts: 0
- suspected duplicate operations: 0

## 5. Gap Register

No unresolved operation-definition ambiguity was identified during minimum inventory derivation.

If ambiguity is discovered during contract authoring, it shall be recorded as an explicit governed operation-definition gap in GCSOM-0001.

## 6. Scope Constraint

This catalog does not yet define:
- full per-operation contract fields
- typed operation dependency graph
- permitted and prohibited operation composition matrices

Those definitions are deferred to subsequent GCSA-0003 artifacts.