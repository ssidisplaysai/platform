# GAR-1000: Genesis Automation Registry Specification v1.0

Status: Draft for Formal Governance Review
Program: Genesis Automation Platform
Program ID: GAP-0001
Classification: Genesis Standard
Type: Foundational Specification

## 1. Purpose

The Genesis Automation Registry provides the canonical, governed inventory of automation assets known to Genesis OS.

It answers the question:

What automation assets exist, what are they permitted to do, which version is authoritative, and what is their current governed state?

The registry exists to prevent automation authority from being fragmented across workflow engines, source repositories, spreadsheets, operator knowledge, vendor consoles, or application-specific inventories.

The registry establishes a deterministic and auditable control plane by:

- assigning stable identity to every governed automation asset
- separating automation meaning from engine-specific implementation
- defining mandatory metadata and lifecycle state
- preserving version, ownership, dependency, policy, and provenance information
- enabling deterministic discovery by Genesis services
- making registration and validation prerequisites for governed operation
- producing immutable evidence of lifecycle changes

An executable workflow alone is insufficient. A workflow becomes a governed Genesis automation asset only after registration, validation, versioning, and lifecycle authorization.

## 2. Scope

### 2.1 In Scope

- canonical automation asset identity
- supported automation asset classifications
- authoritative registry responsibilities
- mandatory registry metadata categories
- lifecycle state definitions and transition constraints
- registration, validation, approval, publication, and retirement requirements
- semantic versioning and revision rules
- ownership and stewardship requirements
- discovery and dependency representation
- policy, security, audit, and provenance obligations
- registry event requirements
- conformance requirements for adapters, services, and consumers
- extension rules for future automation types and execution engines

### 2.2 Out of Scope

- engine-specific workflow definition formats
- n8n node configuration
- runtime execution algorithms
- user-interface design
- secrets storage implementation
- metrics storage implementation
- alert delivery implementation
- deployment infrastructure selection
- persistence technology selection
- source-control branching policy outside registry artifacts
- detailed API endpoint design, which is governed by a subsequent specification

## 3. Architectural Principles

1. The registry is authoritative for automation inventory.
2. Identity precedes implementation.
3. Registration precedes governed execution.
4. Metadata precedes discovery and activation.
5. Automation governance is engine-agnostic.
6. Every authoritative asset version is immutable after publication.
7. Lifecycle transitions are explicit, authorized, and auditable.
8. Identical governed inputs produce deterministic validation outcomes.
9. Registry consumers must not maintain competing authoritative inventories.
10. Secrets are referenced but never stored as registry plaintext.
11. Execution engines are implementation providers, not governance authorities.
12. Automation dependencies are declared, externally referable, and traceable.
13. Deprecated and retired assets remain historically discoverable.
14. Extension must preserve backward compatibility with the canonical asset contract.
15. Operational evidence must remain distinguishable from declarative registry state.

## 4. Canonical Definitions

### 4.1 Automation Asset

A controlled, versioned, governed unit of automated behavior that can be discovered, validated, authorized, operated, observed, and audited through Genesis OS.

### 4.2 Automation Definition

The declarative description of an automation asset, including identity, purpose, contracts, dependencies, implementation binding, operational policies, and governance metadata.

### 4.3 Automation Implementation

The executable or interpretable realization of an automation definition within an execution engine or runtime.

### 4.4 Registry Record

The canonical persisted representation of one automation asset version and its governed metadata.

### 4.5 Execution Engine

A system capable of executing an automation implementation, including n8n, Genesis Runtime, Temporal, Airflow, serverless runtimes, agent runtimes, or future engines.

### 4.6 Adapter

A component that translates between an execution engine's native model and Genesis registry, event, execution, or observability contracts.

### 4.7 Authoritative Version

The registered asset version currently designated as the approved reference for a defined environment or operational context.

### 4.8 Lifecycle Event

An immutable fact recording a registry state transition or other governed registry action.

### 4.9 Operational Event

An immutable fact recording execution, health, metric, alert, or runtime behavior. Operational events do not independently change declarative registry authority.

## 5. Registry Authority

The Genesis Automation Registry is the authoritative source for:

- automation asset existence
- canonical automation identity
- asset type and classification
- ownership and stewardship
- authoritative versions
- lifecycle state
- declared inputs and outputs
- implementation bindings
- dependencies and integration references
- execution policy references
- governance and security classifications
- approval and publication status
- provenance and audit references

Execution engines may retain native definitions and execution history, but they must not be treated as the authoritative Genesis inventory.

Mission Control, health services, metrics services, alert services, AI operations, deployment services, and administrative tooling must discover governed automation assets through registry authority or registry-derived projections.

## 6. Supported Automation Asset Types

The initial canonical type system includes:

- `workflow`
- `agent`
- `pipeline`
- `integration`
- `connector`
- `scheduler`
- `trigger`
- `event-handler`
- `prompt-pack`
- `template`
- `decision-engine`

Type-specific specifications may impose additional requirements but may not weaken GAR-1000 invariants.

New asset types may be introduced only when:

1. their semantic boundary is explicitly defined
2. they implement the canonical asset contract
3. validation rules exist
4. lifecycle behavior is defined
5. backward compatibility is preserved
6. registry consumers can safely treat unknown types as non-executable unless capability support is declared

## 7. Canonical Identity

### 7.1 Identity Requirements

Every automation asset must have one immutable canonical identity.

The identity must be:

- globally unique within Genesis authority
- stable across repositories, filenames, engines, deployments, and versions
- human-readable
- externally referable
- normalized deterministically
- independent of vendor-generated identifiers

### 7.2 Canonical URI Form

The canonical URI scheme is:

```text
gar://<asset-type>/<namespace>/<asset-name>
```

Examples:

```text
gar://workflow/seo/blog-generator
gar://workflow/company/customer-onboarding
gar://agent/support/customer-assistant
gar://integration/content/wordpress
gar://pipeline/genome/evidence-ingestion
```

### 7.3 Identity Invariants

- Canonical identity must not include a semantic version.
- Versions are subordinate records of the same asset identity.
- Renaming a display name does not change canonical identity.
- Changing asset meaning beyond compatible evolution requires a new canonical identity.
- Engine-native IDs must be recorded as implementation references, not canonical identity.
- Deleted, retired, or archived identities must not be reassigned.

## 8. Canonical Metadata Categories

Each registry record must declare metadata in the following categories.

### 8.1 Identity

- canonical ID
- asset type
- namespace
- machine name
- display name
- description
- semantic version
- schema version

### 8.2 Ownership

- owning organization
- business domain
- accountable owner
- technical steward
- support contact or support policy reference

### 8.3 Classification

- business criticality
- risk level
- security classification
- data classification
- environment eligibility
- tags

### 8.4 Contracts

- input contracts
- output contracts
- failure contract
- idempotency declaration
- side-effect declaration
- compatibility constraints

### 8.5 Implementation Binding

- execution engine
- runtime type
- implementation reference
- engine-native identifier when applicable
- source reference
- artifact digest or integrity reference
- adapter identifier and adapter version when applicable

### 8.6 Invocation

- trigger types
- schedule references
- accepted commands or events
- manual invocation eligibility
- caller authorization requirements

### 8.7 Operational Policy

- timeout policy
- retry policy
- concurrency policy
- rate policy
- compensation policy when applicable
- service-level objective reference
- execution window reference

### 8.8 Dependencies

- automation dependencies
- integration dependencies
- data dependencies
- infrastructure dependencies
- prompt or model dependencies
- secret references
- policy references

### 8.9 Governance

- lifecycle state
- validation status
- approval status
- approver references
- publication timestamp
- effective timestamp
- deprecation timestamp when applicable
- retirement timestamp when applicable

### 8.10 Provenance and Audit

- creator
- creation timestamp
- source provenance
- change rationale
- prior version reference
- registry event references
- review references

Detailed field structure is governed by GAR-1001.

## 9. Lifecycle Model

The canonical lifecycle states are:

```text
Declared
Registered
Validated
Approved
Published
Active
Suspended
Deprecated
Retired
Archived
```

### 9.1 Declared

The asset has been identified but has not entered registry authority as a complete record.

### 9.2 Registered

A registry record exists and satisfies minimum identity and ownership requirements.

### 9.3 Validated

The asset definition passes all applicable structural, semantic, dependency, policy, and type-specific validation rules.

### 9.4 Approved

An authorized governance actor has approved the validated asset version for publication.

### 9.5 Published

The immutable approved version is available for governed discovery and environment assignment.

### 9.6 Active

The published version is authorized for execution in at least one declared operational context.

### 9.7 Suspended

Execution authorization is temporarily withdrawn without terminating historical authority or future reactivation eligibility.

### 9.8 Deprecated

The asset remains discoverable and may remain operational under explicit policy, but new adoption is discouraged and a replacement or retirement path must be declared.

### 9.9 Retired

The asset is no longer authorized for new execution. Historical records and references remain valid.

### 9.10 Archived

The asset is retained for historical, legal, audit, or recovery purposes and excluded from normal operational discovery.

## 10. Lifecycle Transition Rules

Lifecycle transitions must be executed through an authorized registry operation.

The standard forward path is:

```text
Declared -> Registered -> Validated -> Approved -> Published -> Active
Active -> Suspended
Suspended -> Active
Active|Suspended|Published -> Deprecated
Deprecated -> Retired
Retired -> Archived
```

Additional constraints:

- An asset may not become Validated unless all mandatory validations pass.
- An asset may not become Approved without an authorized approval record.
- An asset may not become Published unless its definition is immutable and integrity-addressed.
- An asset may not become Active without an eligible environment binding and execution authorization.
- A Retired asset may not return to Active. A successor version or new asset identity is required.
- An Archived asset is terminal under normal governance.
- Emergency suspension may occur from Published, Active, or Deprecated states when authorized by policy.
- A failed lifecycle transition must not partially mutate registry state.

## 11. Registration Requirements

Registration must:

1. normalize canonical identity
2. verify identity uniqueness
3. validate minimum required metadata
4. record ownership and provenance
5. assign or verify semantic version
6. bind the record to the applicable schema version
7. calculate or record integrity information
8. persist the record atomically
9. emit an immutable registration event
10. return deterministic success or structured failure

Registration must reject:

- duplicate canonical identity and version combinations
- malformed canonical identities
- missing ownership
- unsupported asset types
- plaintext secrets
- unresolved required schema versions
- invalid implementation references
- prohibited lifecycle state assignment
- records that attempt to overwrite published immutable versions

## 12. Validation Requirements

Validation is mandatory before approval.

Validation classes include:

- schema validation
- identity validation
- semantic validation
- contract validation
- dependency validation
- implementation binding validation
- policy validation
- security validation
- lifecycle validation
- type-specific validation

Validation outcomes must be deterministic for identical governed inputs and validation rules.

A validation result must include:

- asset identity
- asset version
- validator identity and version
- validation timestamp
- rule results
- severity
- machine-readable error codes
- human-readable findings
- final pass or fail result

Warnings may be permitted by policy. Errors block validation state.

## 13. Versioning

### 13.1 Semantic Versioning

Automation asset versions use semantic versioning:

```text
MAJOR.MINOR.PATCH
```

- MAJOR: incompatible contract, behavior, policy, or meaning change
- MINOR: backward-compatible capability addition
- PATCH: backward-compatible correction or operational refinement

### 13.2 Version Invariants

- Published versions are immutable.
- A change to a published definition requires a new version.
- Version order must be monotonic for a canonical identity.
- Every version must reference its immediate predecessor when one exists.
- Multiple versions may coexist in the registry.
- Environment authority must identify the exact active version.
- Rollback changes environment authority; it does not mutate prior records.
- Draft amendments may be replaced before publication only when audit policy preserves required evidence.

### 13.3 Schema Versioning

Registry schema version and automation asset semantic version are independent.

Schema migration must preserve semantic meaning and auditability.

## 14. Ownership and Stewardship

Every asset must declare:

- one accountable owner
- one owning organization
- one technical steward or stewardship policy
- one business domain

The accountable owner is responsible for business legitimacy, lifecycle decisions, and continued necessity.

The technical steward is responsible for implementation health, compatibility, operational documentation, and remediation coordination.

Ownership transfer must be explicit, authorized, and recorded as a registry event.

An asset without valid ownership may not progress beyond Registered and may be suspended by governance policy.

## 15. Dependencies and Relationships

Dependencies must be declared by stable reference.

Supported relationship categories include:

- invokes
- triggered-by
- consumes
- produces
- depends-on
- uses-integration
- uses-connector
- uses-prompt-pack
- governed-by-policy
- supersedes
- replaces
- derived-from-template

A required unresolved dependency blocks validation unless an explicit deferred-resolution policy applies.

Dependency cycles must be detected when prohibited by the applicable asset type or runtime policy.

Registry relationships describe declared authority. Runtime traces describe observed behavior. These must not be conflated.

## 16. Execution Engine and Adapter Conformance

An execution engine adapter must:

- preserve canonical identity and exact version
- map engine-native identity without replacing Genesis identity
- verify activation authority before governed execution
- report execution using Genesis operational event contracts
- preserve correlation and causation identifiers
- reject or quarantine incompatible definitions
- expose adapter identity and version
- avoid storing plaintext secrets in registry records
- support deterministic import or registration behavior where applicable
- report configuration drift when native state diverges from the authoritative registered binding

An adapter may provide additional engine-specific metadata, but such metadata must be namespaced and must not redefine canonical fields.

## 17. Security Requirements

The registry must enforce or support:

- authenticated mutation
- authorized lifecycle transitions
- least-privilege access
- separation of approval and implementation duties where required
- immutable audit evidence
- secret-reference-only storage
- integrity verification for published artifacts
- security and data classification
- environment eligibility controls
- emergency suspension

Registry responses must not expose restricted metadata to unauthorized consumers.

Security policy evaluation failures must fail closed for publication and activation operations.

## 18. Audit and Provenance

Every authoritative mutation must produce auditable evidence containing:

- actor identity
- operation
- asset identity
- asset version
- prior state
- resulting state
- timestamp
- reason or change reference
- correlation identifier
- applicable policy or approval reference

Audit history must be append-only from the perspective of normal registry operations.

Correction of erroneous audit information must occur through compensating records rather than destructive replacement.

## 19. Registry Events

The registry must emit immutable lifecycle events, including as applicable:

- `AutomationDeclared`
- `AutomationRegistered`
- `AutomationValidationCompleted`
- `AutomationApproved`
- `AutomationPublished`
- `AutomationActivated`
- `AutomationSuspended`
- `AutomationReactivated`
- `AutomationDeprecated`
- `AutomationRetired`
- `AutomationArchived`
- `AutomationOwnershipTransferred`
- `AutomationVersionSuperseded`
- `AutomationDriftDetected`

Registry events must include canonical identity, exact version, event identity, timestamp, actor or service identity, correlation data, and transition context.

Execution-started, execution-completed, execution-failed, metric, health, and alert events are operational events and are governed by subsequent contracts.

## 20. Discovery

Registry discovery must support deterministic filtering by at least:

- canonical identity
- asset type
- namespace
- owner
- organization
- business domain
- lifecycle state
- semantic version
- execution engine
- environment eligibility
- dependency
- integration reference
- risk classification
- security classification
- tag

Normal operational discovery must exclude Archived assets unless explicitly requested.

Discovery results must identify whether each record is authoritative, superseded, deprecated, retired, or historical.

## 21. Registry Consistency

The registry must preserve the following invariants:

1. Canonical identity and version are unique.
2. Published records are immutable.
3. Lifecycle transitions are atomic.
4. Failed mutations leave no partial authoritative state.
5. Events correspond to committed state changes.
6. Authoritative environment bindings reference published versions.
7. Active authority cannot reference a retired or archived version.
8. Canonical references resolve deterministically or fail explicitly.
9. Registry projections are reconstructable from authoritative records and events.
10. Competing sources may be reconciled, but only one Genesis authority exists.

## 22. Failure Semantics

Registry operations must return structured failures.

Failure categories include:

- identity conflict
- schema violation
- semantic violation
- unsupported asset type
- unresolved dependency
- policy denial
- authorization denial
- invalid lifecycle transition
- immutable version conflict
- integrity failure
- adapter incompatibility
- persistence failure
- concurrency conflict

Failures must include stable machine-readable codes and must not rely solely on free-form messages.

Retryability must be explicitly classified.

## 23. Extension Model

Extensions must use namespaced metadata and declared schema ownership.

Extensions must not:

- alter canonical identity semantics
- weaken lifecycle requirements
- bypass validation or approval
- overwrite canonical field meaning
- store plaintext secrets
- make published records mutable
- introduce silent fallback behavior that changes governance outcomes

Type-specific and engine-specific extensions must remain removable without destroying the canonical asset record.

## 24. Conformance Requirements

A registry implementation conforms to GAR-1000 only when it:

1. implements canonical identity rules
2. supports the canonical lifecycle model
3. enforces immutable published versions
4. validates required metadata
5. records ownership and provenance
6. produces deterministic validation outcomes
7. performs atomic lifecycle transitions
8. emits immutable registry events
9. prevents plaintext secret storage
10. supports exact-version discovery
11. preserves historical records after deprecation and retirement
12. exposes structured failures
13. supports engine-agnostic automation records
14. passes the approved GAR-1000 conformance test suite

An adapter conforms to GAR-1000 only when it preserves registry authority and satisfies Section 16.

A consumer conforms to GAR-1000 only when it treats the registry or a registry-derived governed projection as the authoritative automation inventory.

## 25. Required Successor Specifications

GAR-1000 requires the following subordinate specifications:

- GAR-1001: Canonical Automation Asset Model
- GAR-1002: Workflow Registration Lifecycle
- GAR-1003: Registry API Contract
- GAR-1004: Registry Validation Rules
- GAR-1005: Automation SDK Metadata Contract

Subordinate specifications may add constraints but may not contradict GAR-1000.

## 26. Acceptance Criteria

GAR-1000 is ready for formal approval when:

- architectural review confirms compatibility with Genesis Runtime and governance standards
- canonical terminology is reconciled with existing Genesis specifications
- lifecycle transitions are represented in machine-testable form
- GAR-1001 can express every mandatory metadata category
- n8n and Genesis-native workflow examples can be represented without vendor-specific changes to the canonical model
- security review confirms secret and authorization boundaries
- conformance requirements are testable
- no unresolved constitutional contradiction remains

## 27. Constitutional Statement

No automation asset is governed, discoverable as authoritative, or eligible for Genesis-controlled activation merely because executable code or an engine-native workflow exists.

Genesis automation authority begins with canonical registration and continues only through validated, approved, versioned, auditable lifecycle governance.
