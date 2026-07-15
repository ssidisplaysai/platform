# GSP-0001: Genesis Specification Governance v1.0

**Identifier**: GSP-0001  
**Title**: Genesis Specification Governance v1.0  
**Version**: 1.0.0  
**Status**: Approved  
**Classification**: Governance Specification  
**Type**: Formal Normative Specification  
**Review Reference**: GAR-0001, GAR-0002  
**Disposition**: Approved by Foundation Authority

**Created**: 2026-07-14  
**Last Updated**: 2026-07-14  
**Approved Date**: 2026-07-14  
**Governance Decision**: GD-0001  

---

## 1. Executive Summary

GSP-0001 establishes the canonical governance model for the Genesis specification system.

This specification defines how specifications are created, reviewed, approved, versioned, amended, verified, certified, frozen, and deprecated.

GSP-0001 is itself a specification, demonstrating the governance principles it establishes.

**Key Outcomes**:
- Deterministic specification lifecycle with objective transition criteria
- Clear authority hierarchy from Constitution through Implementation
- Traceable governance through Governance Decision Records (GD-XXXX)
- Foundation protection through subordination rules
- Role-based authority (not committees)
- Specification-first, implementation-independent governance
- Frozen Foundation that only evolves through formal succession

---

## 2. Purpose

Genesis is a living knowledge system. Its specifications embody validated understanding about enterprise reality, compilation, and execution.

Purpose of GSP-0001:

1. Establish how specifications are governed to preserve knowledge integrity
2. Ensure every specification serves the Genesis Constitution
3. Maintain deterministic, traceable specification evolution
4. Enable solo maintainers and scale to large organizations
5. Protect Foundation stability while supporting planned evolution
6. Prevent circular dependencies and conflicting authority
7. Make governance decisions auditable and permanent

---

## 3. Scope

### In Scope

- Governance principles for all Genesis specifications
- Specification lifecycle model (Draft → Archived)
- Specification versioning and compatibility rules
- Approval authority and decision-making roles
- Amendment and supersession processes
- Verification and certification requirements
- Freeze and deprecation policies
- Governance Decision Records (permanent trace)
- Cross-reference rules and dependency constraints
- Foundation subordination and protection rules

### Out of Scope

- Modifying Genesis Constitution
- Modifying existing approved specifications retroactively (only through amendment process)
- Defining content requirements for specific specification families (e.g., GBS, GCS, BGS)
- Runtime behavior specification
- Compiler implementation details
- Code generation rules

---

## 4. Governance Principles

Governance principles establish the foundational reasoning for all specification governance.

### 4.1 Constitution Before Specification

**Principle**: The Genesis Constitution is immutable. All specifications are subordinate to the Constitution.

**Purpose**: Ensure governance decisions never contradict first principles.

**Normative Statements**:
- Every specification SHALL reference the Constitution as its authoritative foundation
- No specification MAY redefine, contradict, or supersede any constitutional principle
- Conflicts between a specification and the Constitution SHALL be resolved in favor of the Constitution
- Constitutional amendments require formal amendment process; specifications cannot amend the Constitution

**Expected Outcome**: Specifications formalize constitutional principles; Constitution constrains specifications.

### 4.2 Specification Before Standard

**Principle**: Formal specifications define "what must be true" before implementation standards define "how to build it."

**Purpose**: Ensure specifications are implementation-independent and testable.

**Normative Statements**:
- Specifications SHALL define requirements, contracts, and invariants
- Specifications SHALL NOT prescribe implementation language, algorithm, or deployment topology
- Standards MAY implement specifications in specific contexts
- Conflicts between a specification and a standard SHALL be resolved in favor of the specification

**Expected Outcome**: Clear separation between "what" and "how"; specifications remain stable while implementations evolve.

### 4.3 Standard Before ADR

**Principle**: Formal standards define expected practice before individual Architectural Decision Records (ADRs) document specific choices.

**Purpose**: Ensure individual decisions serve broader standards rather than local preferences.

**Normative Statements**:
- Standards SHALL establish baseline practices
- ADRs SHALL justify deviations from or applications of standards
- Conflicts between an ADR and a standard SHALL be resolved in favor of the standard
- ADRs are informative; standards are normative

**Expected Outcome**: Consistent practice governed by standards; exceptional decisions documented in ADRs.

### 4.4 ADR Before Milestone

**Principle**: Architectural decisions are recorded before implementation milestones commit to them.

**Purpose**: Ensure milestones understand and accept their architectural constraints.

**Normative Statements**:
- Milestones SHALL declare applicable ADRs
- Milestones SHALL declare applicable Governance Decisions
- Milestones MAY NOT contradict applicable ADRs or Governance Decisions

**Expected Outcome**: Implementation milestones are predictable and traceable to architectural decisions.

### 4.5 Milestone Before Implementation

**Principle**: Implementation milestones are defined before code is written.

**Purpose**: Ensure implementation is governed by prior decisions rather than ad hoc.

**Normative Statements**:
- Implementations SHALL serve milestones
- Milestones SHALL declare applicable specifications and standards
- Implementations MAY NOT contradict applicable milestones

**Expected Outcome**: Implementation is derived from specification rather than specification derived from implementation.

### 4.6 Verification Before Certification

**Principle**: Specifications are verified to conform to requirements before being certified for use.

**Purpose**: Ensure specifications meet quality gates before becoming normative references.

**Normative Statements**:
- Verification SHALL confirm specification compliance with applicable requirements
- Certification SHALL only occur after successful verification
- Failed verifications SHALL require specification revision or waiver decision

**Expected Outcome**: Certified specifications have demonstrated compliance.

### 4.7 Certification Before Freeze

**Principle**: Specifications are certified to be complete, stable, and correct before they become frozen.

**Purpose**: Ensure frozen specifications will not require immediate amendment.

**Normative Statements**:
- Freeze MAY only occur after certification
- Frozen specifications remain normative until superseded
- Supersession rather than amendment is preferred for frozen specifications

**Expected Outcome**: Frozen specifications are reliable, long-term references.

---

## 5. Governance and Administration

**NORMATIVE DISTINCTION**

### 5.1 Governance vs. Administration

**Governance** defines the rules, states, evidence requirements, and authorized transitions that SHALL remain stable regardless of organizational size or tooling.

Governance characteristics:
- Defines authority boundaries and permitted actions
- Establishes objective criteria for state transitions
- Requires specific evidence for validation
- SHALL remain stable across organizational changes
- Scales from solo maintainers to large organizations without redesign

**Administration** performs the operational tasks required by governance and MAY vary by organization, team size, and available tooling.

Administration characteristics:
- Executes governance requirements
- Includes authoring, reviewing, recording, scheduling, filing, repository management
- MAY vary in implementation detail and tools
- SHALL NOT alter governance requirements
- Operational efficiency MAY improve over time

**NORMATIVE REQUIREMENT**: Administration SHALL NEVER eliminate required evidence, skip lifecycle gates, or bypass authority boundaries defined by governance.

### 5.2 Roles and Role Actions

Governance authority is expressed through roles. A single individual MAY fulfill multiple roles.

When an individual fulfills multiple roles:
- Each role action SHALL be recorded with the role name
- Required evidence for each role action SHALL be provided
- Role transitions SHALL NOT be skipped regardless of role holder overlap
- Administrative efficiency MAY consolidate evidence gathering, but governance gates remain mandatory

**Example**: A solo maintainer who is simultaneously Specification Author, Reviewer, Project Maintainer, and Foundation Authority:
- Writes specification as Author (provides rationale)
- Reviews specification as Reviewer (provides independent assessment)
- Records decision as Project Maintainer (creates Governance Decision)
- Approves as Foundation Authority (final authorization)
- Each action is recorded with role name; all evidence requirements remain

---

## 6. Governance Roles

Governance authority is expressed through roles. A single individual MAY fulfill multiple roles.

### 6.1 Specification Author

**Responsibility**: Create and maintain specification content

**Permissions**:
- Author new specifications (Draft status)
- Propose amendments to specifications
- Provide rationale and justification
- Recommend architectural decisions

**Required Evidence**:
- Clear understanding of subject domain
- Ability to write normative (SHALL/MUST) requirements
- Ability to justify design choices
- Ability to identify affected downstream artifacts

**Accountability**: 
- Specifications authored are technically accurate
- Requirements are objectively testable
- Impact analysis is comprehensive
- Rationale is documented

### 6.2 Specification Reviewer

**Responsibility**: Evaluate specifications for correctness and completeness

**Permissions**:
- Request clarifications or modifications
- Approve specifications for advancement (Draft → Architecture Review)
- Request additional evidence or rationale
- Recommend architecture review

**Required Evidence**:
- Subject matter expertise
- Understanding of downstream consumers
- Ability to identify ambiguities or conflicts
- Familiarity with Genesis governance model

**Accountability**:
- Review is thorough and documented
- Conflicts are identified and escalated
- Recommendations are justified
- Timeline commitments are met

### 6.3 Project Maintainer

**Responsibility**: Manage specification lifecycle and repository

**Permissions**:
- Transition specifications through lifecycle states
- Approve specification advancement (subject to formal process)
- Manage version numbering and tagging
- Record governance decisions
- Enforce governance policies

**Required Evidence**:
- Understanding of Genesis governance model
- Familiarity with all applicable specifications
- Administrative authority over specification repository
- Ability to coordinate reviewers

**Accountability**:
- Lifecycle transitions follow formal process
- Governance decisions are recorded
- Specification versions are traceable
- Amendment workflow is followed

### 6.4 Foundation Authority

**Responsibility**: Protect Genesis Foundation and Constitution

**Permissions**:
- Approve Foundation-level decisions
- Resolve conflicts with Constitution
- Approve Foundation specifications
- Approve Foundation amendments
- Authorize specification freezes

**Required Evidence**:
- Deep understanding of Genesis Foundation and Constitution
- Authority to speak for organizational vision
- Ability to assess long-term impact
- Familiarity with Genesis history

**Accountability**:
- Foundation decisions are consistent with Constitution
- Foundation remains stable and coherent
- Foundation subordination is maintained
- Long-term vision is preserved

---

## 7. Governance Invariants

Governance Invariants establish properties that SHALL remain true regardless of organizational size, tooling, or future platform evolution.

Every Invariant is objectively testable and serves as a design constraint for all specifications created under GSP-0001.

### 7.1 Constitutional Supremacy

**Identifier**: GI-001  
**Invariant**: The Genesis Constitution SHALL remain the highest governing authority.

**Purpose**: Ensure that no specification can redefine or contradict the Foundation.

**Rationale**: The Constitution embodies first principles that transcend temporary organizational needs. Allowing specifications to override constitutional principles would destabilize the Foundation.

**Normative Requirement**: Every specification SHALL explicitly declare its subordination to the Constitution. Conflicts between a specification and the Constitution SHALL be resolved in favor of the Constitution.

**Verification**: Automated check—specification file SHALL contain explicit reference to Genesis Constitution and declaration of subordination.

### 7.2 Foundation Protection

**Identifier**: GI-002  
**Invariant**: Foundation artifacts SHALL remain protected by Foundation governance rules.

**Purpose**: Preserve Foundation stability and coherence across the lifetime of Genesis.

**Rationale**: Foundation artifacts are the lowest-level building blocks. If Foundation rules do not protect them, higher layers become unstable.

**Normative Requirement**: Foundation artifacts (Constitution, frozen architecture specifications) MAY NOT be modified except through explicitly authorized Foundation processes. No non-Foundation specification MAY redefine or contradict a Foundation artifact.

**Verification**: Automated check—diff logs SHALL show no modifications to Foundation artifacts except through approved amendment process.

### 7.3 Specification Subordination

**Identifier**: GI-003  
**Invariant**: Specifications SHALL remain subordinate to the Constitution and applicable Foundation artifacts.

**Purpose**: Maintain hierarchical authority and prevent conflicts.

**Rationale**: Subordination ensures that each specification occupies a defined place in the authority hierarchy and cannot contradict upstream layers.

**Normative Requirement**: Every specification SHALL declare its upstream dependencies. Specifications SHALL NOT expand, redefine, or contradict any upstream specification or Foundation artifact.

**Verification**: Manual review during Architecture Review—Reviewer SHALL confirm upstream dependencies are declared and no contradictions exist.

### 7.4 Traceability to Authority

**Identifier**: GI-004  
**Invariant**: Every implementation SHALL trace to one or more approved specifications or explicitly governed milestones.

**Purpose**: Ensure all work is authorized and documented.

**Rationale**: Without traceability, implementations become disconnected from governance and hidden work may contradict specifications.

**Normative Requirement**: Every implementation milestone SHALL declare applicable specifications, standards, ADRs, and Governance Decisions. Implementations that cannot trace to authorized sources SHALL NOT be approved.

**Verification**: Manual review—Code review SHALL confirm all changes reference applicable specifications or milestones.

### 7.5 Unique Lifecycle State

**Identifier**: GI-005  
**Invariant**: Every specification SHALL occupy exactly one lifecycle state at any point in time.

**Purpose**: Prevent ambiguous state and enable deterministic governance.

**Rationale**: If a specification occupies multiple states simultaneously, it is unclear which rules apply and what actions are permitted.

**Normative Requirement**: State transition SHALL be atomic. A specification SHALL NOT be in Draft and Approved simultaneously. All references to the specification SHALL agree on current state.

**Verification**: Automated check—metadata file SHALL have exactly one State value. No specification SHALL appear in multiple state lists.

### 7.6 Governance Decision Permanence

**Identifier**: GI-006  
**Invariant**: Governance Decision Records SHALL remain permanently traceable.

**Purpose**: Enable accountability and learning from past governance choices.

**Rationale**: If governance decisions can be deleted or hidden, future maintainers cannot learn from past choices and risk repeating mistakes.

**Normative Requirement**: Governance Decisions SHALL NOT be deleted or hidden. Superseded Governance Decisions SHALL remain visible with supersession noted. Supersession relationship SHALL create audit trail.

**Verification**: Automated check—GD archive SHALL be immutable. Deletion attempts SHALL fail. Supersession links SHALL be traceable end-to-end.

### 7.7 Acyclic Governance

**Identifier**: GI-007  
**Invariant**: Circular governance dependencies SHALL NOT exist.

**Purpose**: Prevent indeterminate authority and enable deterministic decision-making.

**Rationale**: Circular dependencies create situations where no authority is truly superior, making decisions indeterminate and potentially contradictory.

**Normative Requirement**: Specification dependencies SHALL form an acyclic directed graph. Circular dependencies SHALL be detected and eliminated by refactoring one specification. Every detected circular dependency SHALL be recorded in a Governance Decision.

**Verification**: Automated check—dependency graph algorithm SHALL detect cycles. Build SHALL fail if cycle detected. Manual review during Architecture Review.

### 7.8 Implementation Independence

**Identifier**: GI-008  
**Invariant**: Governance SHALL remain implementation-independent.

**Purpose**: Enable governance rules to outlast any specific technology choice or platform.

**Rationale**: Specifications written with implementation assumptions become brittle and require redesign when tooling changes. Implementation-independent governance remains stable.

**Normative Requirement**: Specifications SHALL NOT prescribe programming language, runtime environment, deployment topology, or tooling. Specifications SHALL define "what must be true" independent of "how to build it."

**Verification**: Manual review—Specification text SHALL be searched for implementation assumptions. Ambiguous statements SHALL be clarified as language-independent or technology-neutral.

### 7.9 Evidence-Based Transitions

**Identifier**: GI-009  
**Invariant**: Lifecycle transitions SHALL require the evidence defined for the target state.

**Purpose**: Ensure specifications achieve required quality before advancing.

**Rationale**: Without evidence requirements, specifications can advance without meeting quality gates, leading to incomplete or incorrect specifications downstream.

**Normative Requirement**: Every lifecycle transition SHALL require specific evidence (tests passing, reviews complete, documentation provided, etc.). Absence of required evidence SHALL block transition. Transition documentation SHALL reference the evidence provided.

**Verification**: Manual review—Transition records SHALL list required evidence and confirm evidence is present before approving transition.

### 7.10 No Self-Approval

**Identifier**: GI-010  
**Invariant**: No artifact SHALL approve, verify, certify, or freeze itself without an explicitly recorded role action.

**Purpose**: Require external authority for lifecycle advancement and prevent self-serving decisions.

**Rationale**: Allowing artifacts to approve themselves without external review enables hidden conflicts and avoids accountability.

**Normative Requirement**: Every lifecycle transition SHALL be authorized by a role distinct from creation (even if played by the same individual). Authority SHALL be recorded with role name. Self-review by one role does not count as approval by different role.

**Verification**: Manual review—Transition records SHALL show distinct role actions: Author (creates), Reviewer (approves advancement), Maintainer (records decision), Authority (approves critical decisions). Each role action SHALL be separately recorded.

---

## 8. Authority Hierarchy

The following hierarchy establishes subordination relationships. Lower layers serve higher layers.

**Diagram**:
```
┌─────────────────────────────────┐
│ Genesis Constitution            │
│ (Immutable Foundation)          │
└────────────────┬────────────────┘
                 │
      ┌──────────▼──────────┐
      │ Governance          │
      │ Specifications      │
      │ (e.g., GSP-0001)    │
      └──────────┬──────────┘
                 │
      ┌──────────▼──────────┐
      │ Architecture        │
      │ Specifications      │
      │ (e.g., GRA-1.0)     │
      └──────────┬──────────┘
                 │
      ┌──────────▼──────────┐
      │ Domain              │
      │ Specifications      │
      │ (e.g., GBS, GCS)    │
      └──────────┬──────────┘
                 │
      ┌──────────▼──────────┐
      │ Standards           │
      │ (Implementation     │
      │  guidance)          │
      └──────────┬──────────┘
                 │
      ┌──────────▼──────────┐
      │ ADRs                │
      │ (Decisions)         │
      └──────────┬──────────┘
                 │
      ┌──────────▼──────────┐
      │ Implementation      │
      │ Milestones          │
      └──────────┬──────────┘
                 │
      ┌──────────▼──────────┐
      │ Implementation      │
      │ (Code)              │
      └──────────┬──────────┘
                 │
      ┌──────────▼──────────┐
      │ Verification        │
      │ (Tests, Reviews)    │
      └──────────┬──────────┘
                 │
      ┌──────────▼──────────┐
      │ Certification       │
      │ (Approval)          │
      └──────────┬──────────┘
                 │
      ┌──────────▼──────────┐
      │ Release             │
      │ (Deployment)        │
      └─────────────────────┘
```

### 8.1 Subordination Rules

**NORMATIVE**:
- Lower layers SHALL NOT contradict higher layers
- When conflict exists, higher layer is authoritative
- Lower layers serve higher layers
- Higher layers may constrain lower layers
- Lower layers may NOT expand or redefine higher layer contracts

**Example**: A Standard MAY NOT redefine a Specification requirement. An ADR MAY NOT contradict an applicable Standard. Implementation code MAY NOT violate applicable ADRs or Specifications.

---

## 9. Specification Lifecycle

### 9.1 Lifecycle States

Every specification progresses through defined states. State transitions are formal events.

**States**:
1. **Draft** - Specification under creation
2. **Architecture Review** - Specification undergoing formal architecture evaluation
3. **Revision** - Specification undergoing required revisions from Architecture Review
4. **Approved** - Architecture review complete and revisions accepted; specification approved
5. **Implemented** - Specification has been implemented
6. **Verified** - Implementation verified against specification
7. **Certified** - Specification certified complete, correct, and stable
8. **Frozen** - Specification frozen; normative reference established
9. **Deprecated** - Specification superseded; migration period active
10. **Superseded** - Specification replaced by successor
11. **Archived** - Specification retained for historical reference only

### 9.2 State Definitions and Transitions

#### Draft → Architecture Review

**Entry Criteria**:
- Specification has complete sections: Purpose, Scope, Definitions, Normative Requirements
- All SHALL statements are objectively testable
- Rationale is documented
- Affected downstream artifacts are identified
- Author signs off that specification is ready

**Process**:
- Specification Reviewer conducts initial review
- Specification Reviewer recommends readiness for architecture review
- Project Maintainer advances to Architecture Review state
- Notification sent to stakeholders

**Exit Criteria**:
- Initial review complete
- Specification marked for formal architecture review

**Allowed Transitions**:
- → Draft (return for revision)
- → Approved (if architecture review approves)

**Prohibited Transitions**:
- Direct to Implemented, Verified, Certified, or Frozen (must pass Architecture Review)

#### Architecture Review → Revision

**Entry Criteria**:
- Formal architecture review conducted
- Reviewers identified changes required
- Amendment list created with specific revision points
- Governance Decision created documenting required revisions

**Process**:
- Project Maintainer schedules formal review
- Foundation Authority (or designated reviewer) conducts comprehensive evaluation
- Assessment identifies specific revisions needed
- Decision recorded in Governance Decision Record
- Specification marked Revision with revision identifier (e.g., v1.0.0-R1)

**Exit Criteria**:
- Architecture Review complete
- Required revisions identified and documented
- Governance Decision recorded
- Specification marked Revision

**Allowed Transitions**:
- → Architecture Review (return for additional review after revisions complete)
- → Approved (revisions complete and accepted)

**Prohibited Transitions**:
- → Implemented, Verified, Certified, or Frozen (must complete revisions and receive approval first)
- → Deprecated (must either approve or reject; cannot deprecate during revision)

#### Revision → Architecture Review

**Entry Criteria**:
- Required revisions completed
- Specification updated with changes
- Author signs off that revisions are complete
- Request for re-review submitted

**Process**:
- Specification Author completes revisions
- Specification Reviewer conducts re-review
- Changes verified against required revision list
- New Governance Decision created for re-review

**Exit Criteria**:
- Re-review complete
- Specification back in Architecture Review state

**Allowed Transitions**:
- → Revision (if additional revisions required)
- → Approved (revisions accepted)

#### Revision → Approved

**Entry Criteria**:
- Required revisions completed
- Re-review approved revisions
- All governance requirements met
- Foundation Authority approves advancement

**Process**:
- Specification Reviewer confirms revisions address all required changes
- Project Maintainer creates final Governance Decision
- Specification marked Approved
- Version incremented per Semantic Versioning
- Notification sent to stakeholders

**Exit Criteria**:
- Specification marked Approved
- Governance Decision recorded
- Version updated

**Allowed Transitions**:
- → Implemented (when ready for implementation)
- → Deprecated (if rejected or superseded before implementation)

#### Architecture Review → Approved

**Entry Criteria**:
- Formal architecture review conducted
- All reviewers approve without revision requests
- No required changes identified
- Governance Decision created for approval

**Process**:
- Project Maintainer schedules formal review
- Foundation Authority (or designated reviewer) conducts comprehensive evaluation
- Assessment covers: correctness, completeness, clarity, determinism, consistency with Foundation
- Decision recorded in Governance Decision Record stating "Approved without revision"
- Specification marked Approved

**Exit Criteria**:
- Architecture Review complete
- Governance Decision recorded
- Specification marked Approved

**Allowed Transitions**:
- → Implemented (when ready for implementation)
- → Deprecated (if rejected or superseded before implementation)

**Prohibited Transitions**:
- → Draft (must create new version; old version remains for reference)

#### Approved → Implemented

**Entry Criteria**:
- Specification Approved
- Implementation milestone created
- Implementation resources allocated
- Applicable standards and ADRs identified

**Process**:
- Implementation milestone begins
- Code follows applicable standards
- Implementation milestone tracks progress
- Regular verification against specification

**Exit Criteria**:
- Implementation complete
- Implementation verified against specification requirements

**Allowed Transitions**:
- → Verified (when implementation complete and verified)

#### Verified → Certified

**Entry Criteria**:
- Implementation complete
- All tests pass
- All SHALL requirements verified
- No open issues blocking certification

**Process**:
- Certification review conducted
- Evidence of verification provided
- Certification checklist completed
- Foundation Authority approves certification

**Exit Criteria**:
- Certification decision recorded
- Specification marked Certified

**Allowed Transitions**:
- → Frozen (when ready to freeze)

#### Certified → Frozen

**Entry Criteria**:
- Specification Certified
- Implementation stable
- Backward compatibility documented
- No planned amendments for X months (configurable; recommended: 6 months)

**Process**:
- Freeze decision recorded in Governance Decision
- Version tag applied (e.g., v1.0.0-frozen)
- Specification marked immutable
- Notification sent to all downstream consumers

**Exit Criteria**:
- Specification marked Frozen
- Version tag applied
- Governance Decision recorded

**Allowed Transitions**:
- → Deprecated (when ready to phase out)

#### Frozen → Deprecated

**Entry Criteria**:
- Specification Frozen
- Successor specification available OR decision made to phase out
- Migration guide prepared
- Deprecation timeline defined

**Process**:
- Deprecation notice created
- Migration guide published
- Deprecation timeline documented
- All references updated with deprecation notice

**Exit Criteria**:
- Specification marked Deprecated
- Deprecation timeline begins

**Allowed Transitions**:
- → Superseded (when deprecation period complete)

#### Deprecated → Superseded

**Entry Criteria**:
- Specification Deprecated
- Deprecation timeline complete
- Successor available and stable
- Migration complete for critical consumers

**Process**:
- Supersession recorded in Governance Decision
- Successor specification linked
- Migration support ends (except for archived reference)

**Exit Criteria**:
- Specification marked Superseded

**Allowed Transitions**:
- → Archived (optional, after historical value expires)

#### Superseded → Archived

**Entry Criteria**:
- Specification Superseded
- Historical reference period complete
- No active dependencies remain

**Process**:
- Archive decision recorded
- Specification moved to archive storage
- Historical references maintained
- Search results updated to point to archive

**Exit Criteria**:
- Specification marked Archived
- Archive location documented

**Allowed Transitions**:
- None (terminal state)

### 9.3 Lifecycle Summary Table

| State | Purpose | Stability | Normative | Mutable |
|---|---|---|---|---|
| Draft | Development | Low | No | Yes |
| Architecture Review | Formal review | Low-Medium | No | Yes |
| Revision | Required amendments | Low-Medium | No | Yes |
| Approved | Ready for use | Medium | Yes | Yes (amendments) |
| Implemented | In active use | Medium-High | Yes | Yes (amendments) |
| Verified | Quality confirmed | High | Yes | Yes (amendments) |
| Certified | Stable release | High | Yes | Yes (amendments) |
| Frozen | Long-term reference | Very High | Yes | No (successor versions only) |
| Deprecated | Migration period | High | Yes | No (migration guidance only) |
| Superseded | No longer current | Stable | No | No |
| Archived | Historical reference | Stable | No | No |

---

## 10. Versioning Policy

Genesis specifications use Semantic Versioning: **MAJOR.MINOR.PATCH**

### 10.1 Version Components

**MAJOR Version**:
- Breaking architectural change
- Non-backward-compatible requirement change
- Significant new normative sections
- Incompatible with previous implementations
- **Change Rule**: MAJOR increments require new specification identifier OR explicit successor relationship
- **Backward Compatibility**: Previous implementations may break

**MINOR Version**:
- Backward-compatible capability addition
- New optional normative sections
- Clarification of existing requirements
- Compatible with previous implementations
- **Change Rule**: MINOR increments on new capability
- **Backward Compatibility**: Previous implementations remain valid

**PATCH Version**:
- Editorial correction
- Non-semantic clarification
- Grammatical improvement
- Example addition
- No requirement change
- **Change Rule**: PATCH increments on correction
- **Backward Compatibility**: Fully compatible

### 10.2 Version Assignment

**First Version**: 1.0.0 (assigned when Draft → Approved)

**Subsequent Versions**:
- Draft revisions before Approval use same version with pre-release label (e.g., 1.0.0-draft.2)
- Approved version frozen (e.g., 1.0.0)
- Amendments create new versions
  - Non-breaking amendments: increment MINOR (e.g., 1.0.0 → 1.1.0)
  - Breaking amendments: increment MAJOR (e.g., 1.0.0 → 2.0.0)
  - Corrections: increment PATCH (e.g., 1.0.0 → 1.0.1)

### 10.3 Compatibility Expectations

**Normative**:
- Implementations conforming to version X.Y.Z remain valid for all X.Y.* versions
- Major version change signals potential breaking change; migration guidance required
- Patch versions never require implementation change
- Minor versions may require consumer awareness but not implementation change

---

## 11. Governance Decision Records

Governance Decision Records (GD-XXXX) create permanent, traceable records of governance choices.

### 11.1 Purpose

- Record every formal governance decision
- Preserve rationale and alternatives considered
- Enable future accountability and learning
- Make governance decisions discoverable and searchable
- Support amendment and supersession tracking

### 11.2 GD Record Identifier Format

**Format**: `GD-NNNN` where NNNN is a zero-padded sequence number

**Examples**: GD-0001, GD-0042, GD-1000

**Assignment**: Project Maintainer assigns sequentially as decisions are made

### 11.3 GD Record Content

Every Governance Decision Record SHALL include:

| Field | Type | Required | Purpose |
|---|---|---|---|
| Identifier | GD-XXXX | Yes | Unique, searchable reference |
| Title | String | Yes | Human-readable summary |
| Date | ISO 8601 | Yes | Decision timestamp |
| Authority | Role Name | Yes | Who made the decision |
| Summary | Narrative | Yes | One-paragraph decision summary |
| Motivation | Narrative | Yes | Why the decision was necessary |
| Rationale | Narrative | Yes | Reasoning and justification |
| Affected Specifications | List | Yes | Applicable specifications |
| Affected Standards | List | No | Applicable standards |
| Affected ADRs | List | No | Applicable architectural decisions |
| Affected Implementations | List | No | Affected milestones or code |
| Alternatives Considered | Narrative | Yes | Other options and rejection reasons |
| Compatibility Assessment | Narrative | Yes | Backward compatibility impact |
| Supersession | Reference | No | If supersedes earlier decision, reference it |
| Superseded By | Reference | No | If superseded by later decision, reference it |
| Revision History | Table | Yes | Audit trail of amendments |

### 11.4 Decision Permanence

**NORMATIVE**:
- Governance Decisions SHALL NOT be deleted or hidden
- Superseded Governance Decisions SHALL remain visible with supersession noted
- Supersession relationship SHALL create audit trail
- All GD records SHALL remain searchable
- Project Maintainer SHALL maintain complete GD archive

---

## 12. Amendment Workflow

Amendments to specifications follow a formal workflow.

### 12.1 Amendment Types

**Editorial Amendment** (PATCH version):
- Non-semantic correction
- Grammatical improvement
- Example addition
- No requirement change
- Fast track (24 hour review)

**Compatible Amendment** (MINOR version):
- New optional capability
- Clarification of existing requirement
- No breaking changes
- Standard track (1 week review)

**Breaking Amendment** (MAJOR version or successor spec):
- Incompatible requirement change
- Removal of previously required capability
- Architectural redesign
- Extended track (2 week review + Foundation Authority approval)

### 12.2 Amendment Process

**1. Proposal**
- Author completes amendment form
- Change Summary: what changed
- Motivation: why change is needed
- Impact Analysis: what breaks, what changes
- Affected downstream: specifications, standards, implementations

**2. Initial Review**
- Specification Reviewer conducts initial assessment
- Reviewer recommends amendment type (PATCH, MINOR, MAJOR)
- Reviewer assesses impact
- Reviewer identifies downstream consumers

**3. Governance Decision**
- Project Maintainer creates Governance Decision Record
- GD record documents decision rationale
- GD record identifies affected artifacts
- Approver (varies by amendment type) records decision

**4. Implementation** (if applicable)
- Amendment applied to specification
- Version incremented per Semantic Versioning
- Specification marked with amendment tag
- GD reference added to specification

**5. Notification**
- Downstream consumers notified
- Migration guidance provided (if breaking change)
- Deprecation timeline established (if applicable)

### 12.3 Amendment Authority

**Editorial Amendments** (PATCH):
- Specification Author proposes
- Specification Reviewer approves (24 hour window)
- Project Maintainer applies

**Compatible Amendments** (MINOR):
- Specification Author proposes
- Specification Reviewer approves (1 week review)
- Project Maintainer applies

**Breaking Amendments** (MAJOR):
- Specification Author proposes
- Specification Reviewer assesses impact
- Foundation Authority approves
- Project Maintainer applies
- Governance Decision created
- Downstream consumers notified with migration guidance

**Supersession** (New specification replaces old):
- Follow Breaking Amendment process
- Create explicit supersession link
- Old specification marked Deprecated
- Migration support provided

---

## 13. Compliance Model

Every implementation milestone SHALL declare compliance with applicable specifications.

### 13.1 Compliance Declaration

Each implementation milestone SHALL document:

**Applicable Specifications**:
- Which specifications govern this milestone
- Version of each specification
- Any conditional applicability

**Applicable Standards**:
- Which standards apply to this milestone
- Version of each standard

**Applicable ADRs**:
- Which architectural decisions apply
- Any deviations and justification

**Applicable Governance Decisions**:
- Which GD records constrain this milestone
- Any material dependencies

**Compatibility Considerations**:
- Backward compatibility requirements
- Deprecated features retained
- Migration paths for breaking changes

### 13.2 Compliance Verification

**Pre-Certification Verification**:
- All applicable specifications reviewed
- Specification requirements verified
- No contradictions identified
- All tests pass
- Code review confirms compliance

**Certification Gate**:
- Compliance verified before certification approval
- Failed compliance blocks certification
- Verification evidence documented

---

## 14. Freeze and Deprecation Policy

### 14.1 Freeze Criteria

A specification MAY become Frozen only when ALL of the following are true:

1. **Certified**: Specification is in Certified state
2. **Stable**: No amendments anticipated for minimum 6 months
3. **Backward Compatible**: All compatibility implications documented
4. **Communicated**: All downstream consumers aware
5. **No Open Issues**: No unresolved bugs or ambiguities

**NORMATIVE**:
- Freeze is a formal decision recorded in Governance Decision Record
- Frozen specifications are normative long-term references
- Frozen specifications evolve through successor versions, not direct modification

### 14.2 Supersession Strategy

**Preferred Approach for Frozen Specifications**:
- Do NOT amend Frozen specifications directly
- Create successor specification with explicit supersession link
- Mark original as Deprecated with migration path
- Support transition period (minimum 6 months, recommended 12 months)

**Example**:
- GBS-1.0 Frozen (cannot be directly amended)
- GBS-2.0 created with breaking changes
- GBS-1.0 marked Deprecated
- Migration guide published
- Support period: 12 months
- After support period: GBS-1.0 marked Superseded

### 14.3 Deprecation Timeline

**Deprecation Phases**:

1. **Deprecation Notice** (Month 0)
   - Specification marked Deprecated
   - Migration guide published
   - All references updated with deprecation banner
   - End-of-life date announced

2. **Migration Period** (Months 1-6)
   - Successor available and stable
   - Support continues for old specification
   - Migration tools and guidance provided
   - Active consumers migrate

3. **End-of-Life** (Month 6, can be extended)
   - Support ends for old specification
   - New implementations use successor only
   - Specification marked Superseded
   - Archive preparation begins

4. **Archive** (Optional, after 12 months)
   - Historical reference preserved
   - Search results point to archive
   - No active references remain

---

## 15. Cross-Reference Model

### 15.1 Permitted Relationships

```
Constitution ← all specifications
Governance Specs ← Architecture Specs, Domain Specs
Architecture Specs ← Domain Specs, Standards
Domain Specs ← Standards, ADRs
Standards ← ADRs, Implementations
ADRs ← Implementations, Milestones
Implementations ← Milestones
```

**Rule**: Arrows point DOWNWARD only. Lower layers MAY reference higher layers but NEVER vice versa.

### 15.2 Circular Dependency Prevention

**NORMATIVE**:
- Circular specification dependencies SHALL be prohibited
- If circular dependency discovered, one specification SHALL be refactored
- All specifications SHALL declare upstream dependencies
- Project Maintainer SHALL detect and prevent circular dependencies

**Validation**:
- Dependency graph SHALL be acyclic
- Architecture Review SHALL validate dependency graph
- Governance Decisions SHALL record circular dependency resolutions

---

## 16. Foundation Protection

### 16.1 Foundation Immutability

**NORMATIVE**:
- Genesis Constitution is immutable except through formal Constitutional amendment process
- Foundation specifications are immutable once Frozen
- Foundation documents cannot be relocated, renamed, or restructured without Foundation Authority approval
- Specifications are subordinate to Foundation; no specification may redefine Foundation

### 16.2 Subordination Rules

**NORMATIVE**:
- Every specification SHALL explicitly reference its upstream dependencies
- Every specification SHALL conform to all upstream specifications
- Conflicts between a specification and any upstream layer SHALL be resolved in favor of the upstream layer
- Specifications SHALL NOT expand, redefine, or contradict upstream requirements

**Example**: A Domain Specification (GBS) SHALL NOT contradict the Governance Specification (GSP-0001) or the Architecture Specification (GRA-1.0).

---

## 17. Normative vs. Informative Sections

### 17.1 Normative Language

**RFC 2119 Markers**:
- **SHALL** / **MUST**: Mandatory requirement
- **SHALL NOT** / **MUST NOT**: Prohibited
- **SHOULD** / **RECOMMENDED**: Expected but not mandatory
- **MAY** / **OPTIONAL**: Permitted but not required

**Example Normative Statements**:
- "Every specification SHALL declare its upstream dependencies."
- "Frozen specifications SHALL NOT be directly amended."
- "Governance Decisions SHALL be permanently traceable."

### 17.2 Informative Language

**Markers**:
- "INFORMATIVE"
- "For information"
- "Example"
- "NOTE"
- "Commentary"

**Informative Content**:
- Rationale and motivation
- Examples and use cases
- Historical context
- Recommended practices (SHOULD language)
- Future directions

---

## 18. Compliance Requirements

Every specification created after GSP-0001 approval SHALL comply with GSP-0001.

### 18.1 Specification Compliance Checklist

- [ ] Specification has explicit identifier (SPEC-XXXX, GCS-0001, etc.)
- [ ] Specification has clear Purpose and Scope
- [ ] Specification uses RFC 2119 normative language
- [ ] Every SHALL statement is objectively testable
- [ ] Normative and Informative sections are clearly marked
- [ ] Upstream dependencies are declared
- [ ] Affected downstream artifacts identified
- [ ] Circular dependencies checked and prevented
- [ ] Specification is subordinate to all upstream layers
- [ ] Specification does not modify Foundation documents
- [ ] Specification is implementation-independent
- [ ] Rationale is documented
- [ ] Governance Decision will be created for approval
- [ ] Version numbering follows Semantic Versioning
- [ ] Specification reviewed per lifecycle criteria

### 18.2 Certification Criteria

A specification SHALL be certified when ALL of the following are true:

1. **Correctness**: Specification is technically accurate and complete
2. **Clarity**: Every requirement is unambiguous and testable
3. **Consistency**: No internal contradictions; consistent with upstream
4. **Compliance**: Specification complies with GSP-0001
5. **Verification**: Specification requirements are verified by implementation
6. **Authority**: Appropriate authority has approved certification

---

## 19. Governance Decision Records (Examples)

GSP-0001 itself exemplifies the governance model.

### 19.1 GD-0001: Approve GSP-0001 Specification

| Field | Value |
|---|---|
| Identifier | GD-0001 |
| Title | Approve GSP-0001: Genesis Specification Governance v1.0 |
| Date | 2026-07-14 |
| Authority | Foundation Authority |
| Summary | GSP-0001 establishes the canonical governance model for all Genesis specifications. Approved for implementation and verification. |
| Motivation | Genesis requires formal specification governance to maintain Foundation stability, ensure deterministic evolution, and prevent circular dependencies. |
| Rationale | Specification-first governance ensures implementations serve specifications rather than vice versa. Frozen Foundation prevents destabilization while supporting planned evolution. |
| Affected Specifications | All future Genesis specifications |
| Affected Standards | All future Genesis standards |
| Supersession | None (first governance specification) |

---

## 20. Implementation Guidance (Informative)

**INFORMATIVE**: The following guidance is recommended practice but not mandatory.

### 20.1 Recommended Roles Assignment (Solo Maintainer)

A single individual MAY fulfill all roles:
1. Specification Author (write specifications)
2. Specification Reviewer (self-review for completeness)
3. Project Maintainer (manage lifecycle)
4. Foundation Authority (approve high-impact decisions)

**Note**: For large organizations, recommend distinct individuals.

### 20.2 Recommended Governance Decision Frequency

- **GD-0001 to GD-0010**: Foundation specification period (GSP-0000, GSP-0001, core architecture)
- **GD-0011 onward**: Ongoing governance decisions as specifications are created, amended, superseded

### 20.3 Recommended Review Timeline

- **Editorial Amendment (PATCH)**: 24 hours
- **Compatible Amendment (MINOR)**: 1 week
- **Breaking Amendment (MAJOR)**: 2 weeks + Foundation Authority review

---

## 21. Governance Metrics

**INFORMATIVE**: The metrics defined in this section are explicitly informative and SHALL NOT create certification requirements in GSP-0001 v1.0.

Future Mission Control capabilities MAY consume these metrics. Implementation of metric collection is not required for GSP-0001 compliance.

### 21.1 Specification Coverage

**Meaning**: Percentage of planned Genesis features that have corresponding governance specifications.

**Suggested Calculation**: (Number of specifications covering planned features) / (Total planned features) × 100%

**Intended Use**: Identify gaps in specification coverage; prioritize new specifications needed.

**Limitations**: Does not measure specification quality or completeness; only tracks existence.

### 21.2 Review Completion Rate

**Meaning**: Percentage of specifications that have completed formal Architecture Review.

**Suggested Calculation**: (Specifications in Approved or later state) / (Total specifications) × 100%

**Intended Use**: Track specification readiness; identify bottlenecks in review process.

**Limitations**: Approved status does not guarantee quality; only that review occurred.

### 21.3 Governance Decision Count

**Meaning**: Total number of Governance Decision Records created.

**Suggested Calculation**: Count all GD-XXXX records.

**Intended Use**: Measure governance activity; track major decisions over time.

**Limitations**: Does not distinguish major from minor decisions; count only.

### 21.4 Average Review Duration

**Meaning**: Average time specifications spend in Architecture Review state.

**Suggested Calculation**: Sum of (Architecture Review exit date - Architecture Review entry date) for all specifications / (Number of specifications reviewed)

**Intended Use**: Identify review bottlenecks; plan review resource allocation.

**Limitations**: Does not account for revisions or re-reviews; only first pass.

### 21.5 Outstanding Amendment Count

**Meaning**: Number of proposed amendments awaiting decision.

**Suggested Calculation**: Count all amendment proposals in backlog.

**Intended Use**: Measure governance workload; plan review capacity.

**Limitations**: Does not account for amendment priority or impact.

### 21.6 Deprecated Specification Count

**Meaning**: Number of specifications in Deprecated state.

**Suggested Calculation**: Count specifications with state = Deprecated.

**Intended Use**: Track migration status; ensure migration support is active.

**Limitations**: Does not measure migration progress or consumer readiness.

### 21.7 Frozen Specification Count

**Meaning**: Number of specifications in Frozen state.

**Suggested Calculation**: Count specifications with state = Frozen.

**Intended Use**: Measure stability; identify long-term references.

**Limitations**: Frozen count does not indicate quality or relevance.

### 21.8 Governance Debt

**Meaning**: Gap between current and target specification coverage for all planned Genesis capabilities.

**Suggested Calculation**: (Target specification count - Actual specification count) + (Specifications in Draft or Architecture Review state)

**Intended Use**: Prioritize specification work; estimate effort for specification completion.

**Limitations**: Requires definition of "target" specification count; subjective.

### 21.9 Lifecycle Transition Failure Count

**Meaning**: Number of attempted lifecycle transitions that were blocked due to unmet criteria.

**Suggested Calculation**: Count all blocked transition attempts.

**Intended Use**: Identify governance gate effectiveness; measure quality enforcement.

**Limitations**: Blocked transitions may be intentional (waiting for evidence) not failures.

### 21.10 Traceability Coverage

**Meaning**: Percentage of implemented code that can be traced to approved specifications or explicit Governance Decisions.

**Suggested Calculation**: (Code lines with traceability) / (Total code lines) × 100%

**Intended Use**: Measure implementation accountability; identify untracked work.

**Limitations**: Requires traceability infrastructure; subject to measurement granularity.

---

## 22. Compliance Matrix

**NORMATIVE**: The following matrix establishes relationships between artifact types and governance constraints.

This matrix preserves the authority hierarchy and explicitly does NOT assign authority to committees or boards.

| Artifact Type | Governed By | May Depend On | Must Not Contradict | Required Evidence | Reviewed By | Approved/Transitioned By | Verification Expectation | Certification Expectation |
|---|---|---|---|---|---|---|---|---|
| Constitution | Self | None | None | Formal amendment process | Foundation Authority | Foundation Authority | Historical consensus | Immutable |
| Governance Specs (GSP-XXXX) | Constitution | Constitution | Constitution, Foundation artifacts | Formal Architecture Review, GD record | Foundation Authority | Foundation Authority | Consistency with Constitution | Deterministic lifecycle |
| Architecture Specs (GRA, GBS, GCS) | Constitution, Governance Specs | Governance Specs, Foundation | Constitution, Governance Specs | Architecture Review, compliance checklist | Specification Reviewer | Project Maintainer + Foundation Authority (if breaking) | Conformance to upstream | Stability, clarity |
| Domain Specs | Constitution, Governance Specs, Architecture Specs | Architecture Specs, Standards | Constitution, Governance, Architecture | Architecture Review, compliance checklist | Specification Reviewer | Project Maintainer | Conformance to upstream | Correctness, clarity |
| Standards | All upstream | ADRs, Implementations | All upstream specs | Review, rationale | Specification Reviewer | Project Maintainer | Practical applicability | Industry best practice |
| ADRs | All upstream | Implementations, Milestones | All upstream specs | Decision record, rationale | Architecture team | Project Maintainer | Justified exceptions only | Risk assessment |
| Governance Decisions (GD-XXXX) | Constitution, Governance, scope | Related artifacts | Constitution, applicable specs | Decision date, authority, rationale | N/A (decision is evidence) | Authority role specified in GD | Traceability link | Permanent audit trail |
| Implementation Milestones | All applicable specs + ADRs | Implementation code | All upstream | Milestone plan, declared specs | Project lead | Project Maintainer | Schedule adherence | Correctness vs spec |
| Implementation Code | Milestones + specs + standards | Tests, verification | Milestones, specs, standards | Code review, tests | Developer peer | Project Maintainer | Test coverage, compliance | Specification conformance |
| Verification Evidence | Specs + Milestones | N/A | Specs, Milestones | Test results, review logs | QA, Reviewer | Project Maintainer | Completeness of coverage | All requirements verified |
| Certification Records | Specs + Verification | N/A | Specs, Verification results | Evidence sign-off, GD record | Foundation Authority | Foundation Authority | Signature, date | No open issues |
| Releases | Certified specs + code | Previous release | All upstream specs | Release notes, commit log | Project Maintainer | Foundation Authority (major) | Traceability to specs | Backward compatibility |

**Matrix Interpretation**:
- **Governed By**: Upstream authority that constrains this artifact
- **May Depend On**: Artifacts this type may reference or depend on
- **Must Not Contradict**: Artifacts this type cannot conflict with
- **Required Evidence**: Documentation/records required for validity
- **Reviewed By**: Role responsible for quality review
- **Approved/Transitioned By**: Role with authority to advance
- **Verification Expectation**: What validation is needed
- **Certification Expectation**: Gate criteria for moving to Certified state

---

## 23. References and Relationships

### Normative References

- Genesis Constitution (`genesis/CONSTITUTION.md`)
- GRA-1.0: Genesis Reference Architecture (`genesis/architecture/GRA-1.0.md`)
- SPEC-0000: Genesis Specification Index (`genesis/specifications/SPEC-0000-Specification-Index.md`)

### Informative References

- SPECIFICATION_MAP.md - Specification dependencies
- EVOLUTION_MODEL.md - Living system evolution model
- RFC 2119 - Key words for use in RFCs

---

## 24. Revision History

| Version | Date | Status | Notes |
|---|---|---|---|
| 1.0.0 | 2026-07-14 | Approved | Architecture Review (GAR-0001, GAR-0002) completed; 5 revisions applied; approved by Foundation Authority (GD-0001); ready for certification |
| 1.0.0-R1 | 2026-07-14 | Revision | Architecture Review (GAR-0001) revisions applied; added Governance Invariants, Revision state, Governance Metrics, Compliance Matrix, Governance and Administration clarification |
| 1.0.0 | 2026-07-14 | Draft | Initial governance specification |

---

## 25. Amendment Tracking

This specification may be amended following the Amendment Workflow (Section 12).

Governance Decisions affecting this specification:

| GD ID | Title | Impact | Status |
|---|---|---|---|
| GD-0001 | Approve GSP-0001 | Approved specification for immediate implementation | **EFFECTIVE** |
| GD-0002+ | Future amendments | TBD | Pending |

---

**End of GSP-0001: Genesis Specification Governance v1.0 — Architecture Review Revision 1**

---

## IMPLEMENTATION NOTES (INFORMATIVE)

GSP-0001 is self-demonstrating:

1. **This Specification Itself**: Follows all governance principles defined herein
2. **Lifecycle Example**: GSP-0001 begins as Draft, will advance through Architecture Review → Approved → Verified → Certified → Frozen
3. **Versioning Example**: First version is 1.0.0; future amendments will create 1.1.0, 2.0.0, etc.
4. **Governance Decision Example**: GD-0001 records the decision to approve GSP-0001
5. **Authority Hierarchy Example**: GSP-0001 is subordinate to the Constitution and GRA-1.0

When GSP-0001 is Approved, all future Genesis specifications SHALL comply with it.

---

**STOP BEFORE COMMITTING**
