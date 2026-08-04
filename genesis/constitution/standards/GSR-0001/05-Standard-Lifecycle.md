# 05 Standard Lifecycle

Lifecycle states:

1. Draft
2. Review
3. Approved
4. Established
5. Superseded
6. Retired
7. Historical

Transition policy:

1. Draft to Review
- Who may transition: Domain Standard Owner with Registry Maintainer confirmation.
- Required evidence: Complete draft package and scope declaration.
- Required approvals: Owner sign-off.
- Historical preservation: Draft versions retained in working history.

2. Review to Approved
- Who may transition: Governance Architecture Board.
- Required evidence: Conflict scan, authority mapping, and traceability matrix.
- Required approvals: Governance Architecture Board recorded decision.
- Historical preservation: Review comments and decision trail preserved.

3. Approved to Established
- Who may transition: Registry Maintainer after approval confirmation.
- Required evidence: Approved decision artifact and registry registration entry.
- Required approvals: Registry publication approval.
- Historical preservation: Established baseline hash and registration timestamp preserved.

4. Established to Superseded
- Who may transition: Governance Architecture Board through successor approval.
- Required evidence: Successor artifact with explicit supersession statement.
- Required approvals: Governance Architecture Board supersession decision.
- Historical preservation: Predecessor remains immutable and linked to successor.

5. Superseded to Retired
- Who may transition: Governance Architecture Board.
- Required evidence: Retirement rationale and non-operational declaration.
- Required approvals: Governance Architecture Board retirement decision.
- Historical preservation: Retired artifact remains addressable and auditable.

6. Retired to Historical
- Who may transition: Registry Maintainer.
- Required evidence: Retirement completion record and archive indexing.
- Required approvals: Registry governance confirmation.
- Historical preservation: Full artifact package, approvals, and lineage retained permanently.

Lifecycle invariants:

1. Established standards are normative until superseded or retired.
2. Superseded and retired standards remain permanently discoverable.
3. No state transition may erase prior evidence or decision records.
