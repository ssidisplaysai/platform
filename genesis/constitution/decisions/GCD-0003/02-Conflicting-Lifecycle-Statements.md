# 02 Conflicting Lifecycle Statements

Conflict scope:

- genesis/constitution/design/GPD-0001/12-Governance-Lifecycle.md
- genesis/governance/phase-closeouts/GFP-0001/06-Governance-Lifecycle.md

Exact sequence in GPD-0001/12:

Constitution -> Vision -> Platform Design Review -> Engineering -> Independent Certification -> Condition Resolution -> Final Certification -> Release -> Enterprise Adoption -> Mission Control Observation

Exact sequence in GFP-0001/06:

Constitution -> Constitutional Vision -> Platform Design Standard -> Platform Design Review -> Condition Resolution -> Final Design Approval -> Engineering Blueprint -> Engineering Process Standard -> Engineering -> Independent Certification -> Engineering Hardening, if required -> Final Certification -> Platform Release -> Enterprise Adoption -> Mission Control Observation

Exact differences:

1. GPD omits Platform Design Standard.
2. GPD omits Final Design Approval.
3. GPD omits Engineering Blueprint.
4. GPD omits Engineering Process Standard.
5. GPD omits Engineering Hardening stage.
6. GPD places Condition Resolution only after Independent Certification.
7. GFP explicitly includes both design-phase condition resolution and post-certification hardening path.
8. Terminology differs: Vision vs Constitutional Vision, Release vs Platform Release.

Authority-claim assessment:

- GPD file is inside constitutional design standard and uses constitutional language.
- GFP file is a closeout artifact and is derivative by constitutional hierarchy.

Downstream repeats and derived references:

- genesis/governance/audits/GSA-0001/03-Governance-Lifecycle-Audit.md repeats the longer lifecycle sequence as audited target.
- genesis/constitution/engineering/GEP-0001/02-Engineering-Lifecycle.md provides a scoped engineering lifecycle subset rather than a full constitutional governance sequence.
- PDR-1001 lineage and GKN-0000 encode stage evidence consistent with a fuller lifecycle model.
