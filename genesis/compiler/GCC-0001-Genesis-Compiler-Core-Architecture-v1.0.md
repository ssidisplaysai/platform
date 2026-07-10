# GCC-0001: Genesis Compiler Core Architecture v1.0

Document ID: GCC-0001
Status: Draft for Formal Architecture Review
Classification: Genesis Compiler Specification
Type: Architectural Specification

## Normative References

The following references are normative and authoritative.
This specification references them and does not redefine their responsibilities.

- Constitution
- Business Language
- Engineering Standards
- Architecture Governance
- GPS-0001
- GPS-0002
- EIR-0001
- BGS-0001
- BGC-0001

## 1. Compiler Core Purpose

The Compiler Core exists to orchestrate all compiler passes as one deterministic enterprise compiler.
Without Compiler Core orchestration, pass correctness does not imply pipeline correctness.

Why orchestration is required:
- pass ordering must be stable and governed
- pass contracts must be validated at boundaries
- artifacts, diagnostics, and manifests must be unified and auditable
- failures must be isolated and deterministically handled
- replay and reproducibility require canonical execution control

How Compiler Core differs from compiler passes:
- a compiler pass performs domain transformation for one stage
- Compiler Core governs execution lifecycle, contracts, registry, scheduling, validation, diagnostics, and manifests across all passes
- Compiler Core does not perform semantic compilation itself

## 2. Scope

Responsibilities:
- govern compilation lifecycle from session initialization through termination
- orchestrate pass execution using deterministic ordering and declared dependencies
- enforce contract-first boundary validation between passes
- manage compiler context, manifests, artifacts, diagnostics, and version references
- provide replay, restart, resume, and reproducibility controls

Non-responsibilities:
- implementing pass business logic
- interpreting enterprise semantics directly
- generating runtime behavior directly
- replacing normative requirements defined in referenced standards

Architectural boundaries:
- upstream boundary: governed compilation requests and input artifacts
- internal boundary: pass execution contracts and context scope
- downstream boundary: final compiler artifacts and handoff manifests for next systems

## 3. Compiler Core Principles

1. Deterministic execution for equivalent governed input.
2. Reproducibility across environments and time.
3. Implementation independence at architecture level.
4. Immutability of artifacts and lineage records.
5. Compiler isolation between pass execution contexts.
6. Contract-first execution before transformation acceptance.
7. Pass independence with explicit dependencies only.
8. Full auditability of decisions and outcomes.
9. Extensibility without core redesign.
10. No bypass of normative standards.

## 4. Compiler Execution Model

Compilation lifecycle phases:
1. Session Initialization
2. Input Binding
3. Contract Validation
4. Pass Scheduling and Execution
5. Artifact and Diagnostic Aggregation
6. Final Validation and Manifest Sealing
7. Session Termination

Compiler sessions:
- every compilation runs in a uniquely identifiable session
- session identity is stable within execution scope
- session metadata is immutable once sealed

Compiler context:
- includes configuration, version references, manifest references, and artifact registry pointers
- context is partitioned into read-only and mutable scopes

Compiler state:
- state transitions are explicit and finite
- illegal transitions are rejected with diagnostics

Compiler artifacts:
- artifacts are append-only outputs of passes
- previous artifacts are never mutated

Compiler manifests:
- manifests represent canonical session execution records
- manifest sealing marks compilation completion or governed failure

Compiler termination:
- success: all required passes complete and validation thresholds satisfied
- failure: fatal constraints or invariant violations halt progression

Compiler restart:
- restart creates a new governed session referencing prior sealed session lineage

Compiler replay:
- replay re-executes governed pass plan for reproducibility verification
- replay does not mutate original session artifacts

## 5. Compiler Pass Model

Compiler pass identity:
- every pass has canonical pass identity, version, and capability declaration

Pass contracts:
- each pass defines input contract, output contract, invariants, and diagnostics schema

Pass inputs and outputs:
- passes consume declared upstream artifacts only
- passes emit artifacts with provenance and metadata envelopes

Pass dependencies:
- dependencies are explicit, acyclic, and contract-bound

Pass ordering:
- ordering derives from declared dependencies and deterministic scheduler rules

Pass lifecycle:
- registered, validated, scheduled, executing, completed, failed, deprecated

Pass isolation:
- passes execute within controlled context boundaries
- no pass may mutate artifacts from prior passes

Pass compatibility:
- compatibility is evaluated against compiler core version, contract version, and referenced standards

Pass versioning:
- pass version changes are classified for compatibility impact and governance requirements

Pass metadata:
- includes identity, version, capability tags, dependency declarations, and deprecation state

## 6. Pass Registry

Pass registration architecture:
- registry is the authoritative catalog of executable pass contracts
- registration requires contract declaration and compatibility metadata

Pass discovery:
- compiler core resolves pass availability from registry snapshot bound to session start

Pass metadata model:
- identity
- version
- contract schema references
- capabilities
- dependencies
- deprecation/replacement metadata

Pass lookup:
- deterministic lookup by pass identity and compatible version constraints

Pass compatibility:
- registry validates pass compatibility with compiler core and pipeline contract versions

Pass capabilities:
- capabilities are declarative and non-ambiguous
- capabilities do not override pass ordering or dependency rules

Pass deprecation:
- deprecated passes remain referable for replay and historical validation
- deprecation does not erase prior execution compatibility records

Pass replacement:
- replacement requires explicit compatibility statement and migration guidance

## 7. Pass Scheduler

Execution ordering:
- scheduler determines execution order from dependency graph and policy constraints

Dependency resolution:
- unresolved dependencies block scheduling and emit fatal diagnostics

Execution phases:
- preflight, execution, post-validation, sealing

Execution boundaries:
- each pass execution boundary enforces input contract validation and output acceptance checks

Deterministic scheduling:
- equivalent pass set and dependency declarations produce equivalent schedule

Failure isolation:
- pass failure is isolated to dependent subtree impact with explicit propagation rules

Resume behavior:
- non-fatal interrupted sessions may resume from last sealed boundary if policy allows

Restart behavior:
- restart creates new session lineage with prior state references; no in-place mutation

Retry policy:
- retry eligibility and limits are policy-governed and deterministic
- retries are explicit events in diagnostics and manifest

## 8. Compiler Context

Shared context:
- shared across passes for governed metadata and references only

Read-only context:
- normative references, compiler configuration baseline, registry snapshot, session identifiers

Mutable compilation state:
- scheduler state, pass status, validation accumulators, diagnostic aggregation state

Compiler configuration:
- immutable session configuration baseline with explicit override policy

Compiler metadata:
- compiler core version, pipeline version, manifest version, environment descriptors

Version references:
- references to GPS, EIR, BGS, BGC and other normative version anchors

Manifest references:
- links to session manifests, pass manifests, and validation manifests

Artifact references:
- stable references to immutable artifacts produced during session

## 9. Artifact Management

Artifact identity:
- governed by canonical identity standards and compiler namespace conventions

Artifact lifecycle:
- declared, created, validated, published, archived

Artifact versioning:
- version metadata attached at artifact publication boundary

Artifact storage model:
- implementation-neutral immutable artifact store with deterministic retrieval semantics

Artifact relationships:
- explicit lineage and dependency relations between artifacts

Artifact traceability:
- every artifact must trace to pass identity, session identity, and input lineage

Artifact manifests:
- each artifact class has manifest entries with checksums, versions, and provenance pointers

## 10. Diagnostics Architecture

Diagnostic classes:
- Errors
- Warnings
- Information
- Compiler events
- Validation events

Traceability:
- every diagnostic references session, pass, affected contracts, and artifact identities where applicable

Diagnostic aggregation:
- diagnostics are aggregated across passes into session-wide diagnostic ledger

Diagnostic propagation:
- propagation rules map pass-level diagnostics to scheduler decisions and session outcome

Diagnostic properties:
- deterministic code assignment
- severity taxonomy
- provenance and context metadata
- remediation guidance references

## 11. Validation Architecture

Compiler validation:
- validates session-level invariants, scheduler determinism, and manifest integrity

Pass validation:
- validates pass contract conformance at registration and execution boundaries

Artifact validation:
- validates artifact schema, integrity, lineage completeness, and identity conformance

Contract validation:
- validates input/output compatibility across pass boundaries

Pipeline validation:
- validates end-to-end contract chain and dependency closure

Manifest validation:
- validates manifest schema, checksum consistency, and reference integrity

Validation rules:
- no pass output is accepted without boundary validation
- fatal validation outcomes block publication
- validation diagnostics are mandatory manifest content

## 12. Manifest Architecture

Compiler manifests define canonical execution records for governance, audit, and replay.

Manifest coverage:
- compiler session identity and lifecycle
- pass execution records
- artifact inventories and relationships
- version references
- diagnostics summary and details
- input and output references
- checksums and integrity attestations
- timestamps and phase markers

Manifest principles:
- immutable after sealing
- reproducible under replay conditions
- sufficient for independent audit

## 13. Extension Architecture

External compiler passes:
- external passes integrate via registry contracts and compatibility declarations

Future compiler passes:
- insertion requires declared dependencies, contract definitions, and validation integration

Plugin model:
- plugin model is contract-governed and capability-declared
- plugin execution remains subject to scheduler and validation constraints

Pass replacement:
- replacement requires migration strategy and replay compatibility stance

Pass insertion:
- inserted pass must preserve deterministic ordering and invariant compliance

Compatibility rules:
- compatibility evaluated across compiler core version, pass version, and pipeline version

Version compatibility:
- explicit compatibility matrices are part of registry metadata

## 14. Compiler Pipeline Architecture

Overall pipeline architecture is pass-ordered, contract-validated, and manifest-sealed.

Pipeline layers:
- orchestration layer (Compiler Core)
- transformation layer (compiler passes)
- validation layer (boundary and session validators)
- observability layer (diagnostics and manifests)

Pipeline architecture includes:
- deterministic pass ordering
- explicit compiler boundaries
- immutable artifact flow
- mandatory validation flow
- complete diagnostic flow

Conceptual flow:
- pass outputs become governed inputs to downstream passes only after validation
- diagnostics influence scheduler decisions and final session state
- manifests record every accepted transition and boundary decision

## 15. Architectural Invariants

1. Every compiler pass has a contract.
2. Every artifact has provenance.
3. Every pass execution is deterministic under equivalent governed input.
4. Every compiler session is reproducible.
5. No pass bypasses validation.
6. No artifact loses lineage.
7. No pass mutates previous artifacts.
8. No undeclared dependency is allowed.
9. No pass executes outside scheduler governance.
10. No session is sealed without manifest integrity validation.
11. No compatibility violation is silently accepted.
12. No diagnostic is dropped from final session ledger.
13. No extension may violate core invariants.

## 16. Relationship to Runtime

Compiler responsibilities:
- transform and validate artifacts through governed compilation orchestration
- produce canonical compile outputs, diagnostics, and manifests

Runtime responsibilities:
- execute deployed systems and operational behavior
- produce observations and runtime evidence for future compilation cycles

Handoff boundary:
- compiler handoff is defined by sealed artifacts and manifests only
- runtime does not alter compiler-sealed artifacts in place

Anti-overlap rules:
- Compiler Core does not execute runtime behavior
- Runtime does not redefine compiler orchestration contracts

## 17. Versioning Strategy

Compiler Core Version:
- version identifies orchestration contract set and invariant baseline

Pass Versions:
- each pass version identifies pass contract revisions

Pipeline Version:
- version identifies ordered pass architecture and dependency model

Manifest Version:
- version identifies manifest schema and integrity rules

Compatibility:
- compatibility is explicitly declared and validated across these version dimensions

Migration:
- migration requires declared strategy for session replay and artifact compatibility

Deprecation:
- deprecated versions remain audit-visible and replay-addressable for governance continuity

## 18. Open Questions

1. Session Replay Authority:
What governance policy determines when replay divergence is acceptable versus fatal?

2. Cross-Organization Pipeline Federation:
How should compiler core orchestration boundaries apply when multiple organizations share partial pipeline stages?

3. Extension Trust Model:
What minimum trust attestations are required before third-party pass plugins can join a canonical pipeline?

4. Manifest Retention Policy:
What long-term retention guarantees are mandatory for compiler core manifests across decades?

5. Compatibility Arbitration:
What governance mechanism resolves conflicting compatibility claims among pass providers?

## 19. Architecture Assessment

Clarity:
- Strength: role separation between Compiler Core and passes is explicit.
- Weakness: federation governance details remain open.

Compiler correctness:
- Strength: contract-first validation and invariant model support correctness.
- Risk: weak compatibility governance can undermine correctness guarantees.

Determinism:
- Strength: deterministic scheduling and contract boundaries are central.
- Recommendation: formal deterministic conformance suite should be standardized.

Auditability:
- Strength: manifest and diagnostic architecture provide full traceability.
- Weakness: retention policy detail is pending governance decision.

Maintainability:
- Strength: pass isolation and registry architecture support long-term evolution.
- Risk: uncontrolled extension growth could increase orchestration complexity.

Extensibility:
- Strength: extension model is explicit and compatibility-governed.
- Recommendation: enforce stricter extension admission criteria over time.

Enterprise scalability:
- Strength: architecture supports multi-pass growth and large artifact chains.
- Risk: manifest volume growth requires governance on archival and indexing strategy.

Future evolution:
- Strength: versioning dimensions and deprecation strategy enable controlled evolution.
- Recommendation: establish periodic architecture review cadence tied to major version transitions.

## Governance Note

This specification defines Compiler Core architecture only.
It does not implement scheduling algorithms, dependency graph code, runtime behavior, or production execution logic.
Implementation requires separate approved implementation specifications and governance authorization.
