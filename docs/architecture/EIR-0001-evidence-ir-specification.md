# Evidence Intermediate Representation Specification v1.0

**Document ID:** EIR-0001  
**Title:** Evidence Intermediate Representation Specification  
**Version:** 1.0  
**Status:** Architecture Review Draft  
**Date:** July 9, 2026  
**Classification:** Enterprise Compiler Specification  

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Architectural Principles](#3-architectural-principles)
4. [Evidence Model](#4-evidence-model)
5. [Identity Model](#5-identity-model)
6. [Provenance Model](#6-provenance-model)
7. [Canonicalization Rules](#7-canonicalization-rules)
8. [Validation Rules](#8-validation-rules)
9. [Compiler Contract](#9-compiler-contract)
10. [Relationship to Discovery](#10-relationship-to-discovery)
11. [Relationship to Business Genome](#11-relationship-to-business-genome)
12. [Architectural Invariants](#12-architectural-invariants)
13. [Versioning Strategy](#13-versioning-strategy)
14. [Extension Strategy](#14-extension-strategy)
15. [Open Questions](#15-open-questions)
16. [Architecture Assessment](#16-architecture-assessment)

---

## 1. Purpose

### 1.1 Why Evidence IR Exists

Evidence Intermediate Representation (Evidence IR) is the first canonical representation in the Genesis Enterprise Compiler pipeline. It serves a single, critical purpose:

**To provide a deterministic, compiler-neutral, semantically neutral intermediate representation that preserves all discovery evidence in canonical form, enabling deterministic transformation into enterprise business semantics without data loss, inference, or business logic assumptions.**

### 1.2 Why Discovery Evidence Alone Is Insufficient

Discovery Evidence (the output of Stage 1, Genesis Discovery Engine) successfully captures all raw evidence from discovery interviews with 100% text preservation and deterministic structure. However, it remains tied to discovery representation semantics:

- **Discovery Evidence is Discovery-centric:** It represents text as it was extracted from interviews, organized by question/answer structure, retaining interview methodology semantics.

- **Discovery Evidence preserves source format:** It maintains the structural choices of the discovery interview (sections, question ordering, interviewer decisions about phrasing).

- **Discovery Evidence cannot be directly compiled:** The business semantics implied by evidence (operational decisions, process descriptions, authority relationships, pain points) are mixed with interview methodology artifacts.

- **Discovery Evidence lacks compiler abstraction:** Directly compiling from Discovery Evidence would require business logic to understand interview structure (questions vs. answers, sections, metadata), creating tight coupling between compiler and discovery methodology.

### 1.3 The Compiler Abstraction Gap

Evidence IR exists to fill the abstraction gap:

```
Discovery Evidence              Evidence IR                 Business Genome
↓                              ↓                           ↓
├─ Interview structure         ├─ Canonical evidence      ├─ Decisions
├─ Question/answer pairs       ├─ Deterministic form      ├─ Processes
├─ Interview sections          ├─ Compiler signatures     ├─ Authority
├─ Metadata fields             ├─ Provenance tracing      ├─ Constraints
└─ Page references             └─ No business semantics   └─ Rules
```

Evidence IR normalizes Discovery Evidence into a form where:

1. Interview methodology is abstracted away
2. Evidence is in canonical form
3. Business logic can operate on pure evidence semantics
4. Provenance remains complete
5. Compiler can make deterministic decisions
6. No evidence is lost, inferred, or modified

### 1.4 The Determinism Requirement

Discovery Evidence is deterministic (same input → same output). But determinism alone is insufficient for a compiler representation because it doesn't guarantee **idempotency** or **canonicality**:

- **Non-canonical form:** Two different Discovery Evidence structures could represent the same underlying evidence (e.g., questions in different orders, sections reorganized, equivalent phrasing)

- **Compiler ambiguity:** A compiler operating on non-canonical evidence would need to implement normalization logic, creating multiple valid ways to reach the same business conclusion

- **Reproducibility across sources:** When evidence comes from multiple discovery interviews (Zach, Madison, future interviews), a non-canonical representation would require business logic to recognize equivalent evidence across sources

Evidence IR is **canonical**, meaning:

- **One representation:** Every piece of evidence has exactly one valid IR representation
- **Idempotent canonicalization:** Applying canonicalization rules multiple times produces identical results
- **Cross-source equivalence:** Equivalent evidence from different sources produces identical IR
- **Compiler determinism:** Given the same set of Evidence IR items, the compiler always produces identical output

---

## 2. Scope

### 2.1 Evidence IR Is Responsible For

Evidence IR is the authoritative specification for:

1. **Canonical Evidence Representation**
   - Define the normalized form of all discovery evidence
   - Specify how heterogeneous discovery formats map to canonical form
   - Guarantee that multiple representations of the same evidence produce identical IR

2. **Deterministic Identity**
   - Generate stable, reproducible IDs for evidence items
   - Enable evidence deduplication and consolidation
   - Support cross-source evidence linking

3. **Complete Provenance**
   - Maintain immutable traceability from Evidence IR back through Discovery Evidence to original source
   - Preserve processing history (versions, transformations, validations)
   - Enable forensic analysis of compilation decisions

4. **Compiler Contract**
   - Define the guarantee that compiled Business Genome output is deterministic given Evidence IR input
   - Specify what compiler may and must not assume about Evidence IR semantics
   - Define failure modes and diagnostic requirements

5. **Validation Rules**
   - Define what makes an Evidence IR item valid
   - Specify constraints that must hold
   - Enable detection of invalid or corrupted evidence

6. **Schema Versioning**
   - Define how Evidence IR schemas evolve
   - Specify migration and compatibility rules
   - Enable long-term stability of compiled outputs

### 2.2 Evidence IR Is Explicitly NOT Responsible For

1. **Business Semantics**
   - Evidence IR does NOT interpret what evidence means in business terms
   - Evidence IR does NOT classify evidence as "decision," "process," "constraint," or "rule"
   - Evidence IR does NOT make business logic choices
   - Business Genome is responsible for business interpretation

2. **Storage**
   - Evidence IR is a compiler representation, not a database schema
   - Storage implementation (relational, document, graph, triple store) is orthogonal to this specification
   - This spec defines the canonical form, not persistence format

3. **Runtime Execution**
   - Evidence IR is not a runtime model
   - It does not define how evidence is queried, indexed, or accessed at runtime
   - Enterprise Blueprint and generated runtime are responsible for runtime concerns

4. **Evidence Collection**
   - Evidence IR does NOT specify how evidence is collected
   - Discovery Engine Stage 1 is responsible for evidence collection
   - Future stages (Stage 3+) may add evidence collection mechanisms
   - Evidence IR accepts evidence as input without validating collection methodology

5. **Evidence Inference**
   - Evidence IR does NOT infer missing evidence
   - Evidence IR does NOT synthesize evidence from partial information
   - Evidence IR preserves exactly what was discovered, no more, no less
   - Compiler may infer, but on basis of complete, verifiable Evidence IR

6. **Evidence Classification**
   - Evidence IR does NOT classify evidence by type (decision, process, person, system, etc.)
   - Evidence IR is format-neutral and type-neutral
   - Business Genome performs classification based on Evidence IR and business rules

---

## 3. Architectural Principles

Evidence IR is built on immutable architectural principles that serve as compile-time constraints and verification criteria:

### 3.1 Evidence Immutability

**Principle:** Evidence, once in Evidence IR form, cannot be modified.

- An Evidence IR item represents a specific piece of discovered evidence at a specific point in time
- If source evidence is corrected, updated, or clarified, a new Evidence IR item is created
- The old Evidence IR item remains unchanged and immutable
- The compiler maintains both versions with explicit versioning
- Never overwrite or modify evidence; only add new versions

**Rationale:** 
- Enables forensic analysis of compilation decisions
- Prevents accidental modification of audit trail
- Supports compliance and regulatory requirements
- Ensures Business Genome output is reproducible from historical Evidence IR

**Compiler Implication:**
- Compiler must not mutate Evidence IR
- Any processing that would modify evidence must create new items
- Lineage must track all versions of the same evidence

### 3.2 Evidence Atomicity

**Principle:** Evidence items are atomic and cannot be meaningfully subdivided.

- An Evidence IR item represents a single, complete piece of evidence
- Evidence items cannot be decomposed into smaller evidence items while preserving meaning
- Conversely, Evidence IR items are not artificially aggregated
- The granularity of evidence is: a single discovered fact, statement, description, or assertion

**Definition of Atomic Evidence:**
- A single answer to a single question in an interview
- A coherent statement about an operational fact (workflow, decision, constraint, pain point)
- A description of a person's role, responsibility, or authority
- A single business rule, process step, or system interaction
- One instance of observed behavior or constraint

**Compound Evidence:**
- When discovery captures multiple atomic pieces together (e.g., "We do X and then Y"), Evidence IR can represent compound evidence as a single item if it cannot be meaningfully separated, but provenance must identify the atomic components
- Compiler is responsible for recognizing when compound evidence should be separated

**Rationale:**
- Enables precise deduplication across sources
- Makes business semantics unambiguous
- Prevents artificial fragmentation or aggregation
- Ensures compiler can reason about evidence granularity

**Compiler Implication:**
- Compiler must respect evidence boundaries
- Compiler cannot split atomic evidence
- Compiler can (should) recognize compound evidence and apply decomposition rules

### 3.3 Evidence Determinism

**Principle:** Given identical source evidence, Evidence IR generation must produce identical output.

- Same input evidence → Same Evidence IR output (always)
- Same Evidence IR → Same compiled output (always)
- Processing order does not affect output
- Processing timestamp does not affect output
- Any evidence collection process (Zach, Madison, future interviews) producing equivalent evidence must produce identical Evidence IR

**Determinism Guarantees:**
- Hash/ID generation is deterministic (content-based, not time-based)
- Canonicalization produces unique canonical form
- Field ordering is deterministic
- Null/empty handling is deterministic
- Reference resolution is deterministic

**Determinism Coverage:**
- Within a single discovery source (Stage 1 determinism)
- Across multiple discovery sources (same evidence from different interviews)
- Across processing runs (same input produces same IR today and in 2030)
- Across processing infrastructure (same output on different machines)

**Rationale:**
- Enables reproducible business compilation
- Supports long-term audit trails
- Allows deterministic business logic
- Enables verification of compiler correctness

**Compiler Implication:**
- Compiler output given Evidence IR must be deterministic
- Compiler must not introduce non-determinism
- Any randomness must be explicitly documented and separated from Evidence IR processing

### 3.4 Evidence Versioning

**Principle:** All Evidence IR is versioned, and versions are explicitly tracked.

- Schema Version: Version of Evidence IR specification (e.g., 1.0, 1.1, 2.0)
- Evidence Version: Instance version of a specific evidence item (e.g., v1, v2, when evidence is corrected)
- Compilation Version: Version of the Business Genome compiled from Evidence IR
- Migration Version: Version applied when migrating Evidence IR between schema versions

**Versioning Invariants:**
- Version identifiers are immutable once assigned
- Earlier versions remain accessible and valid
- Later versions do not invalidate earlier versions
- Migration rules preserve evidence semantics across versions
- Compiler tracks which schema version produced which output

**Rationale:**
- Enables long-term evolution of Enterprise Compiler
- Supports evidence lifecycle (discovery → validation → correction → compilation)
- Preserves historical context
- Prevents data loss during schema evolution

**Compiler Implication:**
- Compiler must declare which Evidence IR schema version it requires
- Compiler must handle evidence from multiple schema versions
- Migration must preserve evidence semantics
- Output must declare which Evidence IR version was used

### 3.5 Evidence Canonicality

**Principle:** Evidence IR must be in canonical form, ensuring unique representation.

- Only one valid representation for any given piece of evidence
- Equivalent evidence from different sources produces identical IR
- Canonicalization rules are deterministic
- Canonical form is independent of input format

**Canonical Properties:**
- Whitespace is normalized
- Field ordering is consistent
- References use canonical identifiers
- Duplicates are identified and deduplicated
- Encoding is consistent (UTF-8)
- Null/empty values are handled uniformly

**Rationale:**
- Enables evidence deduplication without domain knowledge
- Supports cross-source evidence linking
- Makes compiler logic simpler and more reliable
- Ensures Business Genome sees consistent evidence semantics

**Compiler Implication:**
- Compiler can assume all Evidence IR is canonical
- Compiler does not need normalization logic
- Compiler can deduplicate on identity/content
- Identical Evidence IR always produces identical output

### 3.6 Evidence Compiler-Neutrality

**Principle:** Evidence IR is independent of any specific compiler implementation.

- Evidence IR does not contain compiler-specific optimizations
- Evidence IR does not assume particular compiler algorithms
- Evidence IR does not encode compiler hints or directives
- Multiple different compilers could process the same Evidence IR and produce equivalent output

**Compiler Neutrality Means:**
- No compiler version dependencies
- No algorithm-specific encoding
- No optimization markers
- No compiler-internal metadata

**Rationale:**
- Enables alternative compiler implementations
- Supports future compiler improvements without re-collecting evidence
- Allows third-party tools to process Evidence IR
- Ensures long-term vendor independence

**Compiler Implication:**
- Compiler may add internal metadata but not in Evidence IR
- Compiler must not assume Evidence IR structure beyond specification
- Alternative compilers must produce equivalent output

### 3.7 Evidence Provenance Preservation

**Principle:** Evidence IR must maintain complete, immutable traceability from Evidence IR back to original source.

- Every Evidence IR item must trace back to specific discovery source
- Provenance chain is immutable
- Processing history is preserved
- Modifications create new items with explicit lineage

**Provenance Chain:**
```
Evidence IR Item
  ↓ provenance
Discovery Evidence (Stage 1 output)
  ↓ provenance
Discovery Source (PDF, transcript, etc.)
  ↓ context
Discovery Interview (Question/Answer/Metadata)
  ↓ context
Interview Source Material (Participant, Role, Date, etc.)
```

**Rationale:**
- Enables forensic analysis
- Supports compliance verification
- Allows evidence correction and re-compilation
- Creates audit trail for business decisions
- Enables discovery of evidence conflicts

**Compiler Implication:**
- Compiler must preserve provenance in output
- Compiler must not lose source traceability
- Compiler must be able to trace output back to evidence
- Business logic must not be conflated with provenance

### 3.8 No Inference in Evidence

**Principle:** Evidence IR contains only discovered evidence, never inferred or synthesized evidence.

- Evidence IR contains what was discovered
- Evidence IR does NOT contain what might be true
- Evidence IR does NOT synthesize missing evidence
- Evidence IR does NOT apply business logic to evidence
- Inference is compiler responsibility, not Evidence IR responsibility

**What Is NOT Evidence:**
- Assumed facts ("They probably do X")
- Inferred relationships ("If A and B are true, then C")
- Filled-in gaps ("Since role X exists, responsibility Y must exist")
- Business logic conclusions ("This implies they need system Z")
- Extrapolated patterns ("This happens everywhere in organization")

**Rationale:**
- Prevents compiler from seeing invented evidence
- Forces explicit evidence collection
- Enables clear separation of discovered vs. inferred facts
- Supports evidence validation

**Compiler Implication:**
- Compiler can infer from Evidence IR
- Compiler cannot assume inferences are in Evidence IR
- Compiler must explicitly flag inferred conclusions
- Business Genome must distinguish discovered from inferred

---

## 4. Evidence Model

Evidence IR defines a hierarchical evidence structure with multiple levels of organization, enabling evidence to be reasoned about at different granularities while maintaining complete traceability.

### 4.1 Evidence Item (Atomic Unit)

**Definition:** An Evidence Item is the smallest unit of evidence in Evidence IR. It represents a single, indivisible piece of discovered information.

**Evidence Item Structure:**

```
Evidence Item
├─ Identity
│  ├─ id (canonical identifier)
│  ├─ schemaVersion (Evidence IR version)
│  └─ contentHash (deterministic hash)
│
├─ Evidence Content
│  ├─ type (evidence_type enum)
│  ├─ statement (primary evidence text)
│  ├─ context (surrounding context)
│  └─ qualifier (certainty/frequency/scope indicators)
│
├─ Metadata
│  ├─ subject (what/who evidence describes)
│  ├─ subjects (multiple subjects if applicable)
│  ├─ scope (individual/team/department/organization)
│  └─ temporality (past/present/ongoing/future tense)
│
├─ Relationships
│  ├─ evidenceContext (other evidence this depends on)
│  ├─ compounds (atomic pieces if compound evidence)
│  └─ related (logically connected evidence)
│
└─ Provenance
   ├─ sourceReference (discovery source)
   ├─ discoveryPath (chain back to original)
   ├─ discoveryVersion (Stage 1 version)
   ├─ importTimestamp (when imported)
   ├─ processingHistory (all transformations)
   └─ validator (who/what validated)
```

**Evidence Item Types:**

Evidence can be classified by type without being classified by business semantics:

- `statement`: A described fact, workflow, or process ("We manually track customers in a spreadsheet")
- `assertion`: A claimed truth ("This system is unreliable")
- `description`: A description of role, responsibility, or activity ("I spend 2 hours daily on email")
- `constraint`: A stated boundary condition ("We can only ship on Tuesdays")
- `decision`: A described decision or decision authority ("I decide on quotes under $5,000")
- `pain_point`: An identified problem or inefficiency ("Email is a bottleneck")
- `capability`: An existing capability or tool usage ("We use Zoho for CRM")
- `need`: An expressed need or desired capability ("We need better lead tracking")
- `measurement`: A quantified observation ("95% of leads come through email")
- `interaction`: A described interaction pattern ("Customers reach us via phone, email, or web form")
- `obstacle`: An identified barrier or blocker ("We don't have the training")
- `opportunity`: An identified improvement opportunity ("Automating this would save 5 hours weekly")

**Evidence Item Properties:**

All Evidence Items share these properties:

- **Immutable:** Once created, cannot be modified
- **Atomic:** Cannot be meaningfully subdivided
- **Versionable:** Can be superseded by newer versions
- **Traceable:** Complete provenance preserved
- **Identifiable:** Unique, deterministic ID
- **Canonical:** Single representation for equivalent evidence

### 4.2 Evidence Collection (Atomic Aggregation)

**Definition:** An Evidence Collection groups logically related Evidence Items while preserving their atomic nature.

**Evidence Collection Structure:**

```
Evidence Collection
├─ id (collection identifier)
├─ title (human-readable name)
├─ scope (collection scope)
├─ items (Evidence Items [])
├─ metadata
│  ├─ itemCount
│  ├─ sourceCount (how many discovery sources)
│  └─ contentHash (deterministic collection hash)
└─ provenance
   ├─ sources (all contributing discovery sources)
   └─ collectionRules (how items were collected)
```

**Collection Scopes:**

- `person`: Evidence about a specific person (Zach, Madison)
- `role`: Evidence about a role ("Operations Manager")
- `team`: Evidence about a team or department
- `process`: Evidence about a process or workflow
- `system`: Evidence about a system or tool
- `problem`: Evidence about a problem or pain point
- `domain`: Evidence about a domain or business area

**Why Collections?**

Collections enable:
- Grouping related evidence for reasoning
- Treating evidence as sets for analysis
- Cross-source consolidation (same evidence from multiple interviews)
- Compiler-level optimization (process evidence vs. person evidence)
- Query and retrieval at appropriate granularity

**Deduplication Within Collections:**

If Evidence Collection contains multiple Evidence Items describing equivalent evidence from different sources:
- Items retain atomic identity
- Collection tracks that they are equivalent
- Compiler can choose to use one representative item or all items
- Provenance preserved for all sources

### 4.3 Evidence Package (Complete Context)

**Definition:** An Evidence Package is a complete, self-contained set of Evidence Items and Collections from a single coherent discovery source.

**Evidence Package Structure:**

```
Evidence Package
├─ packageId (unique identifier)
├─ sourceDiscoveryFile (reference to source)
├─ discoveryVersion (Stage 1 version)
├─ discoveryMetadata
│  ├─ discoveryDate
│  ├─ participants
│  ├─ interviewer
│  └─ discoveryContext
├─ collections (Evidence Collections [])
├─ items (Evidence Items [])
├─ metadata
│  ├─ totalItemCount
│  ├─ collectionCount
│  └─ contentHash
└─ validation
   ├─ isValid
   ├─ validationErrors
   └─ validationWarnings
```

**Evidence Package Properties:**

- Contains only evidence from one discovery source (one interview, one document)
- Is hermetically sealed (complete and self-contained)
- Can be validated, versioned, and migrated independently
- Maintains references to source Discovery Evidence
- Preserves all original provenance

**Why Packages?**

Packages enable:
- Treating evidence from one source as complete unit
- Independent validation of each source
- Version-specific processing
- Clear boundaries between discovery sources
- Incremental evidence integration

### 4.4 Evidence Set (Multi-Source Consolidation)

**Definition:** An Evidence Set is a consolidated collection of Evidence Items and Collections from multiple discovery sources, deduplicated and merged while preserving source distinctions.

**Evidence Set Structure:**

```
Evidence Set
├─ setId (unique identifier)
├─ name (human-readable name)
├─ scope (scope of evidence set)
├─ packages (Evidence Package [])
├─ consolidatedItems (Evidence Items [])
│  ├─ each with sourceReferences to contributing packages
├─ consolidatedCollections (Evidence Collections [])
├─ deduplicationReport
│  ├─ identicalItems (id → [source items])
│  ├─ equivalentItems (id → [similar items with hash distance])
│  └─ mergeRules (rules applied for consolidation)
├─ metadata
│  ├─ totalItems
│  ├─ packageCount
│  ├─ deduplicatedItemCount
│  └─ sourceCount
└─ validation
   ├─ isValid
   ├─ conflicts (evidence conflicts between sources)
   └─ coverage (what's covered by evidence set)
```

**Deduplication Rules:**

Items are considered identical when:
- Content hash is identical (same evidence text/content)
- Canonicalization produces identical form
- Same subject, same evidence type

Items are considered equivalent when:
- Similar content with minor variations (phrasing, tense)
- Describing same underlying evidence from different perspectives
- Different hash but semantically identical after normalization

**Why Evidence Sets?**

Sets enable:
- Cross-source evidence consolidation (Zach + Madison evidence together)
- Enterprise-wide evidence collection
- Conflict detection (contradictory evidence from different sources)
- Coverage analysis (what's been discovered)
- Multi-source reasoning

### 4.5 Evidence Context (Relationship Graph)

**Definition:** Evidence Context captures relationships between Evidence Items, enabling compiler to understand evidence in context.

**Evidence Context Properties:**

```
Evidence Context
├─ contextOf (the evidence item this context describes)
├─ relatedEvidence (related items)
│  ├─ same_topic (describes same topic)
│  ├─ contradicts (conflicts with)
│  ├─ supports (corroborates)
│  ├─ extends (adds detail to)
│  ├─ clarifies (explains)
│  └─ references (mentions)
├─ dependencies
│  ├─ requires (evidence needed to understand this)
│  └─ implies (evidence this implies)
└─ scope
   ├─ narrowerScope (more specific evidence)
   └─ broaderScope (more general evidence)
```

**Context Relationships:**

Relationships describe how Evidence Items relate to other Evidence Items:

- **same_topic:** Two items describe the same topic ("Email management" appears in both Zach and Madison evidence)
- **contradicts:** Two items state conflicting facts (one says process is X, another says it's Y)
- **supports:** Two items corroborate each other (evidence from different sources confirms same fact)
- **extends:** One item adds detail to another (broad statement + specific example)
- **clarifies:** One item explains another (ambiguous statement + clarification)
- **references:** One item mentions another (statement references person, system, process described elsewhere)
- **part_of:** Item is part of larger unit (individual task as part of workflow)
- **instance_of:** Item is instance of pattern (specific decision as instance of decision type)

**Why Evidence Context?**

Context enables:
- Compiler to understand evidence relationships
- Detection of contradictions
- Understanding of evidence granularity
- Cross-source evidence consolidation
- Reasoning about incomplete evidence

---

## 5. Identity Model

Evidence IR identity is deterministic, stable, and designed to enable deduplication, versioning, and long-term traceability.

### 5.1 Stable IDs

**Principle:** Every Evidence IR item has a stable, deterministic ID that is:
- Content-based (not time-based)
- Deterministic across runs
- Deterministic across sources
- Collision-resistant
- Canonical form-sensitive

**ID Generation Algorithm (Specification Only - No Implementation):**

```
Evidence Item ID Generation:
  1. Canonicalize evidence (whitespace, ordering, encoding)
  2. Include in hash calculation:
     - Statement (primary evidence text)
     - Type (evidence type)
     - Subject (what evidence describes)
     - Scope (individual/team/organization/etc)
  3. DO NOT include in hash calculation:
     - Temporal metadata (when discovered)
     - Provenance (who discovered)
     - Versions (multiple instances of same evidence)
     - Compiler metadata
  4. Apply deterministic hash function (e.g., SHA-256)
  5. Encode as stable identifier
```

**ID Stability Properties:**

- **Idempotent:** Same evidence → Same ID (every time)
- **Cross-source:** Equivalent evidence from different sources → Same ID
- **Canonical:** Only canonical form produces valid ID
- **Collision-free:** Different evidence produces different IDs (with high confidence)
- **Versioned:** Different versions of same evidence produce different IDs (version appended)

**ID Format:**

```
evidence_<hash>_v<version>

Example: evidence_a7f3c2e91b_v1
         evidence_a7f3c2e91b_v2  (if evidence was corrected/updated)
```

### 5.2 Evidence Item Versioning

**Principle:** Evidence items are versioned, enabling correction, refinement, and evidence evolution without data loss.

**Version Lifecycle:**

```
Evidence v1 (Original Discovery)
  ↓
  Evidence v2 (Correction/Clarification)
    ↓
    Evidence v3 (Update/Refinement)
      ↓
      Evidence vN (Latest)
```

**Versioning Rules:**

- Each version has unique ID (same content hash, different version number)
- Version v1 is original discovery
- Later versions represent same evidence with corrections or updates
- All versions remain in Evidence IR
- Compiler must declare which versions it uses
- Compiled output must declare evidence versions used

**When to Create New Version:**

- Evidence is corrected (factual error in original discovery)
- Evidence is clarified (original was ambiguous, clarification provided)
- Evidence is updated (what was true no longer applies, update reflects current state)
- Evidence is decomposed (compound evidence split into atomic items)
- Evidence is consolidated (multiple items recognized as single item)

**When NOT to Create New Version:**

- Rephrasing without semantic change (use canonicalization)
- Adding provenance or metadata (create new link, not new version)
- Compiler processing (compiler adds metadata, not new version)
- Discovery of equivalent evidence (deduplicate, don't version)

### 5.3 Package and Collection IDs

**Evidence Package ID:**

```
package_<sourceFileHash>_<discoveryVersion>

Example: package_z9x4k2m1_01
```

Properties:
- Deterministic based on source file
- Includes discovery version
- Stable across processing runs
- Changes only if source file changes

**Evidence Collection ID:**

```
collection_<contentHash>_<scope>

Example: collection_c7e3f1a9_person_zach
```

Properties:
- Based on collection contents
- Includes scope
- Stable if items don't change
- Changes if items are added/removed

**Evidence Set ID:**

```
set_<packageList>_<timestamp>

Example: set_package_z9x4k2m1_01_package_a4m7n3q6_01_20260709
```

Properties:
- Based on contributing packages
- Includes consolidation timestamp
- Changes if packages are added
- Enables multi-source tracking

### 5.4 Identity Guarantees

**Guarantee 1: ID Determinism**

Given:
- Same source evidence
- Same canonicalization rules
- Same schema version

Then:
- ID generation produces identical result
- Running ID generation 1,000 times produces 1,000 identical IDs
- Different machines produce same IDs

**Guarantee 2: ID Stability**

Given:
- Evidence item created at time T1
- Same evidence processed again at time T2 (T2 > T1)

Then:
- ID at T1 = ID at T2
- Temporal distance does not affect ID
- Historical reprocessing produces same IDs

**Guarantee 3: Cross-Source Equivalence**

Given:
- Evidence from Zach interview
- Equivalent evidence from Madison interview

Then:
- If evidence is semantically identical after canonicalization
- Both produce same ID
- Compiler can automatically deduplicate

**Guarantee 4: Version Independence**

Given:
- Evidence Item v1 with ID_A
- Evidence Item v2 (corrected version) with ID_B (where ID_B = ID_A_v2)

Then:
- IDs are distinct
- Version can be tracked
- Both versions remain available
- No ID collision

### 5.5 Lineage Tracking

**Lineage Chain:**

```
Business Genome Output
  ↓ compiled from
Evidence IR Item (ID: evidence_XXX_v1)
  ↓ provenance
Discovery Evidence Reference
  ↓ source reference
Discovery Document (Document ID: doc_ZZZ)
  ↓ source reference
Discovery Source (Interview ID: interview_YYY)
  ↓ source
Interview Question/Answer (Q1, A1)
  ↓ source
Interview Source Material (Interview file, page 1, text offset)
```

**Lineage Properties:**

- Immutable (once created, lineage cannot be modified)
- Complete (every item traces to source)
- Verifiable (can reconstruct path)
- Auditable (can see all transformations)
- Reversible (can trace output back to input)

---

## 6. Provenance Model

Provenance is the immutable record of evidence origin, collection, processing, and transformation. It is the foundation of Evidence IR auditability and compliance.

### 6.1 Provenance Chain

Every Evidence IR item preserves a complete provenance chain:

```
Evidence IR Item
├─ Collected From (Stage 1 output)
│  ├─ Discovery Document ID
│  ├─ Discovery Interview ID
│  ├─ Question Number / Answer Text
│  └─ Page Reference
├─ Discovered From (Original Source)
│  ├─ Interview Date
│  ├─ Participant (Zach, Madison, etc.)
│  ├─ Interviewer (Robert, etc.)
│  ├─ Role
│  └─ Department
├─ Imported At (Evidence IR Import Time)
│  ├─ Timestamp
│  ├─ Import Version
│  ├─ Processing Stage
│  └─ Processing Rules Applied
├─ Transformed By (All Transformations)
│  ├─ Canonicalization (rules applied)
│  ├─ Deduplication (merged with items IDs)
│  ├─ Consolidation (combined from sources)
│  └─ Versioning (version created)
└─ Validated By (Validation History)
   ├─ Validation Rules Applied
   ├─ Validation Results
   ├─ Validation Timestamp
   └─ Validator Identity
```

### 6.2 Provenance Components

**Stage 1 Origin (Discovery Source):**

```
stage1_provenance:
  discoverySourceId: "src_madison_real_discovery_interview"
  discoveryDocumentId: "doc_madison_real"
  discoveryInterviewId: "interview_45da4e58"
  questionNumber: 5
  answerText: "[Full answer text]"
  pageNumber: 1
  characterRange: [1234, 5678]  # Byte offsets
  stage1Version: "1.0"
  stage1ProcessedAt: "2026-07-09T10:30:00Z"
```

Properties:
- References Stage 1 artifacts by ID
- Identifies exact location in source
- Includes version information
- Preserves exact timestamps

**Discovery Interview Metadata:**

```
discovery_metadata:
  interviewDate: "2026-07-08"
  participant: "Madison"
  participantRole: "Operations Manager"
  participantDepartment: "Operations"
  interviewer: "Robert Stoner"
  interviewLocation: "Virtual"
  interviewDuration: "45 minutes"
  discoveryPhase: "Phase 2 - Operational Understanding"
```

Properties:
- Captures discovery context
- Records who discovered evidence
- Includes interview metadata
- Preserves discovery conditions

**Evidence Import Metadata:**

```
evidence_import:
  importedAt: "2026-07-09T12:00:00Z"
  importedBy: "genesis-discovery-stage1-ir-compiler"
  importVersion: "1.0"
  processingPipeline: "Stage1ToEvidenceIR"
  evidenceIRVersion: "1.0"
  canonicalizationRules: ["normalize_whitespace", "sort_fields", ...]
  validationRulesApplied: ["DISC_001", "DISC_002", ...]
```

Properties:
- Records import process details
- Identifies processing pipeline
- Documents rules applied
- Enables rule auditing

**Transformation History:**

```
transformations:
  - operation: "canonicalization"
    timestamp: "2026-07-09T12:00:00Z"
    rulesApplied: ["normalize_whitespace", "sort_references"]
    inputHash: "abc123"
    outputHash: "def456"
  
  - operation: "deduplication"
    timestamp: "2026-07-09T12:00:00Z"
    mergedWith: ["evidence_xyz_v1"]
    deduplicationRules: ["identical_content_hash"]
    resultingId: "evidence_abc_v1"
  
  - operation: "version_update"
    timestamp: "2026-07-09T14:00:00Z"
    reason: "clarification"
    correctionNotes: "Clarified daily volume from '~100' to '100-150 per day'"
    previousVersion: "evidence_abc_v1"
    newVersion: "evidence_abc_v2"
```

Properties:
- Complete history of transformations
- Timestamps for audit trail
- Reasoning for changes
- Before/after hashes for verification

**Validation History:**

```
validations:
  - validationTime: "2026-07-09T12:00:00Z"
    validationVersion: "1.0"
    rulesApplied: ["DISC_001_SourceIdValid", "DISC_002_ContentNotEmpty", ...]
    validationResult: "VALID"
    errors: []
    warnings: ["DISC_WARN_001: No participant metadata"]
    validatedBy: "evidence-ir-validator-1.0"
  
  - validationTime: "2026-07-09T14:00:00Z"
    validationVersion: "1.0"
    validationResult: "VALID_AFTER_UPDATE"
    errors: []
    warnings: []
```

Properties:
- Each validation event recorded
- Validation rules declared
- Results preserved
- Enables validation audit

### 6.3 Provenance Immutability

**Principle:** Provenance cannot be modified once created.

- Original provenance is immutable
- New transformations create new provenance records (appended, never overwritten)
- Provenance history grows, never shrinks
- Audit trail is forensically sound

**Implementation Implication:**

Provenance is append-only:
- Never update existing provenance record
- Add new record for each transformation
- Maintain complete history
- Verify immutability at validation time

### 6.4 Provenance Auditability

**Auditability Requirements:**

1. **Source Verification:** Can identify original discovery source
2. **Path Reconstruction:** Can trace from Evidence IR back to discovery source
3. **Transformation Audit:** Can see every transformation applied
4. **Validation Audit:** Can see what validation was applied and when
5. **Responsibility Audit:** Can identify who/what performed each operation
6. **Timestamp Verification:** Can correlate operations across systems

**Audit Query Examples:**

- "Find all evidence from Madison's interview" → trace back through discovery_metadata
- "What transformations were applied to this evidence?" → examine transformations array
- "When was this evidence last validated?" → check validations array
- "Did this evidence come from Zach or Madison?" → verify stage1_provenance
- "Which compiler version used this evidence?" → check evidence_import version

### 6.5 Long-Term Provenance Preservation

**Requirement:** Provenance must remain valid and verifiable for decades.

**Preservation Guarantees:**

- Provenance format does not depend on external systems
- Provenance is self-contained (includes all context)
- Provenance timestamps are in standard format (ISO 8601)
- Provenance can be understood by future systems
- Provenance is independent of runtime infrastructure

**Future Compatibility:**

- Provenance should be readable by Evidence IR 2.0, 3.0, etc.
- Backward compatibility maintained for old provenance
- Migration preserves provenance without loss

---

## 7. Canonicalization Rules

Canonicalization is the process of transforming Discovery Evidence into canonical Evidence IR form. Canonicalization ensures deterministic representation independent of input format, phrasing, or discovery methodology.

### 7.1 Canonicalization Principles

**Principle 1: Normalization**

Equivalent evidence must produce identical canonical form regardless of input variation:

- **Whitespace:** Multiple spaces → single space, tabs → spaces, leading/trailing → removed
- **Punctuation:** Inconsistent punctuation → canonical form (periods, commas normalized)
- **Capitalization:** Proper nouns preserved, general text to title case (apply rules)
- **Abbreviations:** Common abbreviations normalized to canonical form (CRM → Customer Relationship Management)

**Principle 2: Deterministic Ordering**

When canonicalizing collections, ordering must be deterministic:

- Field ordering: Alphabetical or schema-defined order (never random)
- Reference ordering: Sort by ID (never by timestamp or arbitrary key)
- List ordering: Define canonical order (by severity, by frequency, by creation order)

**Principle 3: Reference Canonicalization**

References must use canonical forms:

- Subject references use canonical subject names (not nicknames or aliases)
- System references use official names (not "the system" or "the tool")
- Role references use canonical role titles
- Scope references use canonical scope indicators

**Principle 4: Encoding Normalization**

All text must be in canonical encoding:

- Character encoding: UTF-8
- Line endings: LF (Unix standard)
- Quote characters: Smart quotes → straight quotes
- Special characters: Preserve but normalize representation

### 7.2 Canonicalization Rules (Non-Implementation Specification)

**Rule: Text Normalization**

```
Input: "We  use   ZOHO   for   CRM."
Step 1 - Whitespace: "We use ZOHO for CRM."
Step 2 - Abbreviation: "We use Zoho for Customer Relationship Management."
Result: "We use Zoho for Customer Relationship Management."
```

**Rule: Punctuation Standardization**

```
Input: "We track customers in a spreadsheet..."
Step 1 - Ellipsis: "We track customers in a spreadsheet."
Result: "We track customers in a spreadsheet."
```

**Rule: Subject Normalization**

```
Input: "I spend my time on emails and meetings"
Subjects identified: ["emails", "meetings"]
Canonical subjects: ["Email Communication", "Meeting Management"]
Result: Subjects stored as ["Email Communication", "Meeting Management"]
```

**Rule: Scope Specification**

```
Input: "We are always waiting for Robert"
Scope analysis: Who is "we"? (Madison + team)
Canonical scope: "team"
Result: Scope explicitly set to "team"
```

**Rule: Temporality Normalization**

```
Input: "I do this every day" (present tense, ongoing)
Input: "We did this last year" (past tense, historical)
Input: "We will implement this" (future tense, planned)
Canonical form: Include explicit temporality indicator
Result: temporality = "ongoing" | "historical" | "planned"
```

**Rule: Null/Empty Handling**

```
Input: "Data missing" / "" / null / undefined
Canonical form: All map to canonical NULL representation
Result: Missing metadata handled consistently

Input: "Unknown" / "Not specified" / "N/A"
Canonical form: All map to UNKNOWN
Result: Unknown values handled consistently
```

### 7.3 Canonicalization Decisions (What Must Be Specified)

**Decision: Handling Compound Statements**

When discovery contains compound statements (multiple facts in one statement):

```
Input: "I handle customer inquiries and pass technical questions to Robert"

Option A - Single compound item:
  evidence_item:
    type: "interaction"
    statement: "I handle customer inquiries and pass technical questions to Robert"

Option B - Two atomic items:
  evidence_item_1:
    type: "capability"
    statement: "I handle customer inquiries"
  
  evidence_item_2:
    type: "interaction"
    statement: "I pass technical questions to Robert"
```

**Specification:** Compound evidence SHOULD be represented as compound item if the two statements are:
- Logically connected (one implies the other or they describe same interaction)
- From same discovery context (same answer/statement)
- Cannot be reasonably separated

If evidence can be separated without loss of meaning, SHOULD be represented as separate atomic items. Compiler can apply decomposition rules if needed.

**Decision: Handling Variations in Phrasing**

When same evidence appears with different phrasing across sources:

```
Zach Interview: "Email is a big time sink"
Madison Interview: "Email management takes significant time"

Canonical form: Both should canonicalize to same representation
Result: Single evidence item with cross-source references
```

**Specification:** Evidence should be canonicalized independently, and if content hashes match, recognized as identical. If hashes don't match but items are semantically equivalent, Compiler applies equivalence rules for deduplication.

**Decision: Handling Ambiguous Subjects**

When discovery mentions subject without explicit identification:

```
Input: "I check it multiple times daily"
Questions: What is "it"? (Email? System? Spreadsheet?)
```

**Specification:** Ambiguous subject references must have:
1. Original subject reference as stated in source
2. Inferred subject reference (if determinable from context)
3. "ambiguous_subject" flag if subject cannot be determined
4. Complete context quote to enable manual disambiguation

**Decision: Handling Negations**

When discovery states what does NOT happen:

```
Input: "We don't have a formal approval process"
```

**Specification:** Negations should be canonicalized as:
- Original statement preserved ("We don't have...")
- Positive restatement ("Approval process is informal/nonexistent")
- Type marked as "absence" or "negative_constraint"

### 7.4 Canonicalization Verification

**Verification Rule 1: Idempotence**

Applying canonicalization twice must produce identical result:

```
Input -> Canonicalize -> Result_1
Result_1 -> Canonicalize -> Result_2
Result_1 == Result_2 (must be true)
```

**Verification Rule 2: Determinism Across Runs**

Processing same input on different machines must produce identical canonical form:

```
Machine A: Input -> Canonicalize -> Result_A
Machine B: Input -> Canonicalize -> Result_B
Result_A == Result_B (must be true)
```

**Verification Rule 3: Content Preservation**

Canonicalization must not lose meaning:

```
Original: "Madison handles customer inquiries and passes technical questions to Robert"
Canonical: "Madison handles customer inquiries. Madison passes technical questions to Robert."
Semantic equivalence: Must be verified by validator
```

---

## 8. Validation Rules

Evidence IR validation ensures that all evidence conforms to specifications and maintains required properties. Validation is non-destructive; it identifies issues without modifying evidence.

### 8.1 Validation Approach

**Principle:** Validation checks consistency with specifications, not business logic.

Validation verifies:
- ✓ Required fields are present
- ✓ Field values conform to type specifications
- ✓ References point to valid items
- ✓ Provenance is complete
- ✓ IDs are valid and deterministic
- ✓ Canonical form is correct
- ✓ Versioning is consistent

Validation does NOT check:
- ✗ Business logic (compiler responsibility)
- ✗ Evidence accuracy (discovery responsibility)
- ✗ Evidence completeness (discovery responsibility)
- ✗ Business semantics (Business Genome responsibility)

### 8.2 Evidence Item Validation Rules

**Rule: Identity Valid (REQUIRED)**

```
Evidence Item MUST have:
  id: Matches format "evidence_<hash>_v<version>"
  contentHash: Valid SHA-256 hash
  schemaVersion: Valid version string (e.g., "1.0")

Validation fails if:
  - ID is missing
  - ID format is invalid
  - ContentHash is not valid hexadecimal
  - SchemaVersion is not recognized
```

**Rule: Content Not Empty (REQUIRED)**

```
Evidence Item MUST have:
  statement: Non-empty string, non-null

Validation fails if:
  - statement is null, undefined, or empty string
  - statement is only whitespace
```

**Rule: Type Valid (REQUIRED)**

```
Evidence Item MUST have:
  type: One of defined evidence types
  
Valid types:
  "statement" | "assertion" | "description" | "constraint" |
  "decision" | "pain_point" | "capability" | "need" |
  "measurement" | "interaction" | "obstacle" | "opportunity"

Validation fails if:
  - type is missing
  - type is not in enumerated list
```

**Rule: Subject Specified (REQUIRED)**

```
Evidence Item MUST have:
  subject (for single subject) OR
  subjects (for multiple subjects)

Validation fails if:
  - Both subject and subjects are missing
  - Both are provided (contradictory)
  - Subject/subjects are empty or null
```

**Rule: Scope Valid (REQUIRED)**

```
Evidence Item MUST have:
  scope: One of ["individual", "team", "department", "organization"]

Validation fails if:
  - scope is missing
  - scope value not in enumerated list
```

**Rule: Temporality Specified (REQUIRED)**

```
Evidence Item MUST have:
  temporality: One of ["past", "present", "ongoing", "future", "unknown"]

Validation fails if:
  - temporality is missing
  - temporality value not in enumerated list
```

**Rule: Provenance Complete (REQUIRED)**

```
Evidence Item MUST have ALL:
  stage1_provenance (discovery source reference)
    discoverySourceId
    discoveryDocumentId
    discoveryInterviewId
    questionNumber OR answerText
    pageNumber
  
  discovery_metadata (discovery context)
    interviewDate
    participant
    participantRole

Validation fails if:
  - Any required provenance field is missing
  - References point to invalid items
  - Dates are malformed
```

**Rule: Relationships Valid (WARNING if invalid)**

```
Evidence Item relationships (if present) MUST reference valid items:
  evidenceContext: Must reference valid Evidence Item
  compounds: Must reference valid Evidence Items (if compound item)
  related: Must reference valid Evidence Items

Validation warning if:
  - Referenced item does not exist
  - Circular references detected
  - Invalid relationship type
```

### 8.3 Evidence Collection Validation Rules

**Rule: Collection Identity (REQUIRED)**

```
Evidence Collection MUST have:
  id: Matches format "collection_<hash>_<scope>"
  
Validation fails if:
  - ID is missing or malformed
```

**Rule: Collection Contains Items (REQUIRED)**

```
Evidence Collection MUST have:
  items: Non-empty array of Evidence Items (size > 0)

Validation fails if:
  - items array is missing
  - items array is empty
  - items contains non-evidence-items
```

**Rule: Collection Scope Valid (REQUIRED)**

```
Evidence Collection MUST have:
  scope: One of ["person", "role", "team", "process", "system", "problem", "domain"]

Validation fails if:
  - scope is missing
  - scope is not in enumerated list
  - scope doesn't match actual items in collection
```

**Rule: Collection Metadata (REQUIRED)**

```
Evidence Collection MUST have:
  title: Non-empty string
  itemCount: Matches actual items.length
  contentHash: Valid hash

Validation fails if:
  - title is missing or empty
  - itemCount doesn't match items array
  - contentHash doesn't match content
```

### 8.4 Evidence Package Validation Rules

**Rule: Package Identity (REQUIRED)**

```
Evidence Package MUST have:
  packageId: Matches format "package_<sourceHash>_<discoveryVersion>"
  sourceDiscoveryFile: References valid source
  discoveryVersion: Valid version string

Validation fails if:
  - packageId is missing or malformed
  - sourceDiscoveryFile cannot be found
  - discoveryVersion is invalid
```

**Rule: Package Contains Evidence (REQUIRED)**

```
Evidence Package MUST have:
  items: Array of Evidence Items (size >= 0)
  collections: Array of Evidence Collections (size >= 0)
  
At least one of items OR collections must be non-empty.

Validation fails if:
  - Both items and collections are empty (completely empty package)
```

**Rule: Package Metadata Complete (REQUIRED)**

```
Evidence Package MUST have:
  discoveryMetadata:
    discoveryDate: Valid date
    participant: Non-empty string
    interviewer: Non-empty string
  
Validation fails if:
  - Any required discoveryMetadata is missing
  - Dates are malformed
```

**Rule: Package Determinism (REQUIRED)**

```
Evidence Package MUST be deterministic:
  If processed twice from same source:
    Result_1.contentHash == Result_2.contentHash
  
If determinism is not guaranteed:
  Validation warning (package may have non-deterministic elements)
```

### 8.5 Evidence Set Validation Rules

**Rule: Set Identity (REQUIRED)**

```
Evidence Set MUST have:
  setId: Matches format "set_<packageList>_<timestamp>"
  
Validation fails if:
  - setId is missing or malformed
```

**Rule: Set Contains Packages (REQUIRED)**

```
Evidence Set MUST have:
  packages: Non-empty array of Evidence Packages (size > 0)

Validation fails if:
  - packages array is missing or empty
```

**Rule: Set Deduplication Report (REQUIRED)**

```
Evidence Set MUST have:
  deduplicationReport:
    identicalItems: Mapping of items recognized as identical
    equivalentItems: Mapping of items recognized as equivalent
    mergeRules: Rules applied for consolidation

Validation fails if:
  - deduplicationReport is missing
  - Report format is invalid
```

**Rule: Set Conflict Detection (WARNING)**

```
Evidence Set SHOULD detect conflicts:
  - Identical evidence with different values
  - Contradictory evidence from different sources
  - Evidence that implies other evidence is false

Validation warning if:
  - Conflicts are detected
  - conflictReport is missing
```

### 8.6 Cross-Item Validation Rules

**Rule: Reference Integrity (REQUIRED)**

```
All references must be valid:
  - evidenceContext references must point to existing Evidence Items
  - compounds references must point to existing Evidence Items
  - related references must point to existing Evidence Items
  
Validation fails if:
  - Reference points to non-existent item
  - Reference is malformed
```

**Rule: ID Uniqueness (REQUIRED within scope)**

```
Within Evidence Package:
  All Evidence Item IDs must be unique
  All Evidence Collection IDs must be unique
  
Within Evidence Set:
  Identical Evidence Items must have identical ID
  Equivalent Evidence Items may have different IDs (tracked in deduplicationReport)

Validation fails if:
  - Duplicate IDs found within scope
  - Same item appears with different IDs
```

**Rule: Versioning Consistency (REQUIRED)**

```
For versioned Evidence Items:
  version_1 content must exist
  version_2 content (if exists) must be subsequent version
  No gaps in version numbers
  Version history must be monotonically increasing

Validation fails if:
  - Version 1 doesn't exist
  - Version numbers are not sequential
  - Content doesn't match version semantics
```

### 8.7 Validation Result Format

**Validation Result Structure:**

```
ValidationResult:
  isValid: boolean (true only if zero errors)
  errorCount: integer
  warningCount: integer
  errors: ValidationDiagnostic[]
  warnings: ValidationDiagnostic[]
```

**Validation Diagnostic:**

```
ValidationDiagnostic:
  code: string (e.g., "EIR_VALIDATION_001")
  severity: "error" | "warning"
  itemId: string (ID of item being validated)
  field: string (field name that failed validation)
  message: string (human-readable message)
  expectedValue: any (what was expected)
  actualValue: any (what was found)
  remediationSuggestion: string (how to fix)
```

### 8.8 Validation Severity Levels

**Error (Validation Failure):**

Evidence is invalid and cannot be used:
- Required field missing
- Invalid field value
- Reference integrity violated
- ID format invalid

**Warning (Validation Issue):**

Evidence is usable but has issues that should be addressed:
- Optional field missing
- Reference points to ambiguous item
- Determinism not guaranteed
- Deprecated feature used

---

## 9. Compiler Contract

The Compiler Contract specifies the formal agreement between Evidence IR and the Business Genome compiler. It defines what Evidence IR guarantees and what the compiler must assume or verify.

### 9.1 Compiler Input Specification

**The compiler receives:**

```
Input:
  - Evidence IR (one or more Evidence Packages or Evidence Set)
  - Compiler Configuration (version, rules, options)
  - Business Logic Rules (how to interpret evidence)
  - Validation Report (evidence validation results)
```

**The compiler must assume:**

✓ All Evidence IR is deterministic  
✓ All Evidence IR is canonical  
✓ All Evidence IR is versioned and traceable  
✓ All required validation rules passed  
✓ All Evidence IR can be processed independently or together  
✓ Evidence Items are atomic and cannot be split  
✓ Provenance is complete and immutable  
✓ IDs are deterministic and stable  

**The compiler must NOT assume:**

✗ Evidence IR contains all evidence about organization  
✗ Evidence IR is business-logically complete (may be contradictions, gaps)  
✗ Evidence IR contains inference or synthesis (only discovered evidence)  
✗ Evidence is unambiguous (may require human interpretation)  
✗ Evidence IR is in any particular order or grouping  
✗ Optional fields are present (only required fields guaranteed)  

### 9.2 Compiler Output Specification

**The compiler produces:**

```
Output:
  - Business Genome (compiled business model)
  - Compiler Report (decisions, transformations, inferences)
  - Evidence Traceability (output back to evidence)
  - Compiler Diagnostics (issues, ambiguities, contradictions)
```

**Output Guarantees:**

✓ Every item in Business Genome traces back to Evidence IR  
✓ Every compiler decision references supporting evidence  
✓ Compiler preserves evidence identity through compilation  
✓ Output is deterministic (same Evidence IR → same output)  
✓ Output declares Evidence IR versions used  
✓ Output includes evidence conflicts and ambiguities  

**Output Constraints:**

✗ Compiler must not invent evidence  
✗ Compiler must not silently discard evidence  
✗ Compiler must not modify Evidence IR  
✗ Compiler must not assume evidence semantics the Business Genome will assign  

### 9.3 Determinism Guarantee

**Core Guarantee:**

```
Given:
  - Evidence IR (set E)
  - Compiler version (V)
  - Compiler configuration (C)
  - Compiler rules (R)

Then:
  Compile(E, V, C, R) at time T1 = Compile(E, V, C, R) at time T2
  
For any T1, T2 (today or in 2030)
And any number of executions (deterministic after 1 or 1000 runs)
```

**Determinism Scope:**

✓ Deterministic within single compiler version  
✓ Deterministic across machine architectures (x86, ARM, cloud)  
✓ Deterministic across operating systems  
✓ Deterministic across processing time (run today = run in 2030)  
✓ Deterministic across processing order (single or parallel)  

**Non-Determinism Boundaries:**

✗ Between different compiler versions (may apply new rules)  
✗ Between different compiler configurations (may produce different output)  
✗ With non-deterministic Evidence IR (compiler faithfully reproduces non-determinism)  

### 9.4 Evidence Traceability

**Every item in Business Genome must be traceable:**

```
Business Genome Item
  ↓ compiled from
Evidence IR Item (ID: evidence_XXX_v1)
  ↓ provenance
Discovery Evidence Reference
  ↓ provenance
Discovery Source (Interview, Question, Answer)
```

**Traceability Requirements:**

1. **Forward Traceability:** Can navigate from source to compiled output
2. **Backward Traceability:** Can navigate from compiled output to source
3. **Bidirectional Traceability:** Can trace in both directions
4. **Evidence Reference:** Every compiled item declares supporting evidence
5. **Inference Tracking:** When compiler infers from evidence, tracks reasoning

**Traceability Implementation:**

Compiler must maintain traceability map:

```
TraceabilityMap:
  businessGenomeItemId → EvidenceIRItemId[]
  
Example:
  "decision_payment_authority_2500" → ["evidence_abc123_v1"]
  "process_customer_inquiry" → ["evidence_xyz789_v1", "evidence_xyz789_v2"]
```

### 9.5 Evidence Conflict Handling

**Principle:** When Evidence IR contains contradictory evidence, compiler must handle explicitly, never silently ignore.

**Types of Conflicts:**

1. **Content Conflict:** Same evidence type with different values
   ```
   Evidence from Zach: "I handle quotes under $5,000"
   Evidence from Madison: "I handle quotes under $10,000"
   Conflict: Authorization limit differs across sources
   ```

2. **Implication Conflict:** Evidence that implies other evidence is false
   ```
   Evidence 1: "Email approval process is required"
   Evidence 2: "No formal approval process"
   Conflict: Logical contradiction
   ```

3. **Scope Conflict:** Same evidence with different scopes
   ```
   Evidence 1: "I make pricing decisions" (Madison's scope)
   Evidence 2: "Pricing is Robert's decision" (Zach's observation)
   Conflict: Decision authority ambiguous
   ```

**Conflict Handling Rules:**

- Never silently resolve conflicts using arbitrary priority
- Always report conflicts in compiler report
- Mark compiled items affected by conflicts as "conflict_detected"
- Preserve all versions of conflicting evidence in output
- Require explicit business logic rule to resolve conflicts

**Compiler Declaration:**

Compiler output MUST include:

```
ConflictReport:
  - conflictCount: number of conflicts detected
  - conflicts: [
      {
        type: "content" | "implication" | "scope"
        evidenceItems: [Evidence Item IDs]
        resolution: "requires_human_review" | "applied_rule_X"
        businessGenomeImpact: [affected items]
      }
    ]
```

### 9.6 Inference Documentation

**Principle:** When compiler infers beyond Evidence IR, inference must be explicitly documented and traceable.

**Allowed Inference:**

- Recognizing equivalent evidence across sources
- Applying business rules to evidence
- Synthesizing higher-order conclusions from evidence
- Classifying evidence by business semantics

**Required Inference Documentation:**

For each inference, document:

```
Inference:
  reasoning: "How did compiler reach this conclusion?"
  supportingEvidence: ["evidence_id_1", "evidence_id_2", ...]
  businessRule: "Which rule was applied?"
  certainty: "high" | "medium" | "low"
  alternativeInterpretations: ["Could also mean...", ...]
```

**Inference Visibility:**

- Compiled output must distinguish inferred from directly supported items
- Inference report must be queryable and auditable
- Business logic can be reviewed against inference report

### 9.7 Failure Handling

**Compiler Failures:**

If compiler cannot process Evidence IR:

```
CompilerFailure:
  failureType: "validation_error" | "processing_error" | "resource_error"
  itemId: "evidence item that caused failure"
  errorMessage: "Description of failure"
  remediation: "How to fix"
  severity: "fatal" | "error" | "warning"
```

**Failure Modes:**

1. **Validation Failure:** Evidence IR fails validation
   - Compiler must reject and report which validation rules failed
   - Suggest remediation to fix Evidence IR

2. **Processing Error:** Compiler cannot process valid Evidence IR
   - Compiler must report error location
   - Suggest workaround or compiler version requirement

3. **Resource Error:** Compiler runs out of resources
   - Compiler must report resource type (memory, time, storage)
   - Suggest resource increase or Evidence IR partitioning

**No Silent Failures:**

✓ Compiler must fail loudly if Evidence IR invalid  
✓ Compiler must fail loudly if processing error  
✓ Compiler must never silently discard evidence  
✓ Compiler must never produce partial output without error report  

### 9.8 Diagnostic Requirements

**Compiler Diagnostic Report Must Include:**

1. **Processing Summary**
   ```
   - Input Evidence IR: package count, item count, collection count
   - Processing started: timestamp
   - Processing completed: timestamp
   - Processing duration: milliseconds
   - Result status: success | partial | failure
   ```

2. **Evidence Processing**
   ```
   - Evidence items processed: count
   - Evidence items used: count
   - Evidence items ignored: count (with reasons)
   - Conflicts detected: count
   - Ambiguities detected: count
   ```

3. **Compilation Results**
   ```
   - Business Genome items created: count by type
   - Inferences made: count
   - Unresolved issues: count
   - Compiler warnings: list
   ```

4. **Determinism Verification**
   ```
   - Reprocessing same input produces identical output: true/false
   - Processing order affects output: true/false
   - All random seeds documented: true/false
   ```

---

## 10. Relationship to Discovery

Evidence IR has a clearly defined boundary relationship with Discovery Evidence (Stage 1 output). This section clarifies responsibilities and prevents overlap.

### 10.1 Discovery Engine (Stage 1) Responsibility

Discovery Engine is responsible for:

✓ Extracting text from discovery sources (PDFs, interviews, transcripts)  
✓ Preserving extracted text exactly (100% text fidelity)  
✓ Organizing extracted text by interview structure (questions, answers, sections)  
✓ Creating Discovery Document, Interview, and validation results  
✓ Generating deterministic IDs at the discovery level  
✓ Maintaining discovery-level provenance  

Discovery Engine is NOT responsible for:

✗ Canonicalizing evidence (Evidence IR responsibility)  
✗ Deduplicating evidence (Evidence IR responsibility)  
✗ Evidence versioning (Evidence IR responsibility)  
✗ Evidence interpretation or classification (Business Genome responsibility)  
✗ Cross-source evidence consolidation (Evidence IR responsibility)  

### 10.2 Evidence IR (Stage 2) Responsibility

Evidence IR is responsible for:

✓ Canonicalizing Discovery Evidence into canonical form  
✓ Deduplicating equivalent evidence (same evidence, different sources)  
✓ Versioning evidence as it evolves (corrections, clarifications, updates)  
✓ Creating Evidence Items from Discovery Questions/Answers  
✓ Organizing Evidence Items into Collections  
✓ Cross-source evidence consolidation (Zach + Madison evidence together)  
✓ Generating Evidence-IR-level deterministic IDs  
✓ Maintaining Evidence IR-level provenance  

Evidence IR is NOT responsible for:

✗ Extracting text from discovery sources (Discovery responsibility)  
✗ Interview methodology (Discovery responsibility)  
✗ Interview validation (Discovery responsibility)  
✗ Interpretation or business classification (Business Genome responsibility)  
✗ Business logic or inference (Business Genome responsibility)  

### 10.3 Discovery Evidence to Evidence Item Mapping

**How Discovery Evidence becomes Evidence Items:**

Each Discovery Answer becomes one or more Evidence Items:

```
Discovery Question: "What does your day actually look like?"
Discovery Answer: "I start by checking email, then review leads from overnight, 
                   then reach out to interested customers. By 10 AM I've usually 
                   sent out 10-15 quotes. Then meetings, then more emails."

Becomes Evidence Items:

Evidence Item 1:
  statement: "Check email first thing in morning"
  type: "description"
  subject: "Email communication"
  
Evidence Item 2:
  statement: "Review overnight leads each morning"
  type: "description"
  subject: "Lead management"
  
Evidence Item 3:
  statement: "Send 10-15 quotes by 10 AM daily"
  type: "measurement"
  subject: "Quote generation"
  scope: "individual"
  
Evidence Item 4:
  statement: "Participate in meetings daily"
  type: "description"
  subject: "Meeting participation"
```

**Mapping Rules:**

1. **Atomicity:** Each Evidence Item represents single, complete fact
2. **Completeness:** All information in answer is captured as Evidence Items
3. **Preservation:** Original answer text preserved in Evidence Item context
4. **Traceability:** Each Evidence Item traces back to specific question/answer

### 10.4 Discovery Metadata to Evidence Metadata

**Discovery Metadata becomes Evidence Metadata:**

```
Discovery Interview:
  participant: "Madison"
  role: "Operations Manager"
  interviewDate: "2026-07-08"
  interviewer: "Robert Stoner"

Becomes Evidence Metadata:

For every Evidence Item from this interview:
  stage1_provenance:
    discoveryInterviewId: "interview_45da4e58"
  
  discovery_metadata:
    participant: "Madison"
    participantRole: "Operations Manager"
    interviewDate: "2026-07-08"
    interviewer: "Robert Stoner"
```

### 10.5 What Gets Lost in Translation (Intentionally)

Some Discovery artifacts are intentionally NOT carried into Evidence IR:

**Discovery-Specific Artifacts NOT in Evidence IR:**

- Interview structure (questions, sections) - not needed at Evidence IR level
- Interview ordering (which questions were asked first) - order doesn't matter for evidence
- Interview methodology (how interview was conducted) - methodology is artifact
- Interviewer subjective notes (e.g., "seemed uncertain") - not objective evidence
- Interview quality assessments - assessments, not evidence

**Rationale:**

These artifacts are discovery-specific and not needed by compiler. Including them would:
- Create compiler dependency on discovery methodology
- Make compiler logic more complex
- Prevent alternative discovery methods from being used
- Increase Evidence IR complexity without benefit

### 10.6 Version Coupling

**Discovery Engine Version Independence:**

Evidence IR specification does NOT depend on specific Discovery Engine version:

- Evidence IR 1.0 can accept output from Discovery Engine 1.0, 1.1, 1.2, etc.
- Discovery Engine output format may evolve (e.g., new metadata fields)
- Evidence IR mapping rules handle variations gracefully

**Discovery Output Format Requirements for Evidence IR:**

Evidence IR requires Discovery Output to include:

✓ Document ID (stable, deterministic)  
✓ Interview ID (stable, deterministic)  
✓ Questions (with text and order)  
✓ Answers (with text, associated question, page references)  
✓ Source metadata (participant, role, date, interviewer, where available)  
✓ Validation results  

Evidence IR does NOT require:

✗ Specific Discovery Engine version  
✗ Specific JSON schema version  
✗ Specific implementation (pdf-parse, other PDF libraries, etc.)  

---

## 11. Relationship to Business Genome

Business Genome is the output of Evidence IR processing. This section defines what Business Genome receives from Evidence IR and what it must NOT assume.

### 11.1 Business Genome Input (Evidence IR Output)

**Business Genome receives from Evidence IR:**

1. **Canonical Evidence Items**
   - Deterministic, deduplicated evidence
   - Organized into Collections and Packages
   - All Evidence Items validated
   - All required provenance preserved

2. **Deterministic Structure**
   - Identical input produces identical output
   - Determinism guarantees enable reproducible compilation
   - Business logic can assume determinism

3. **Complete Provenance**
   - Every Evidence Item traces to discovery source
   - Processing history documented
   - Can audit decisions back to source

4. **Validation Report**
   - Evidence passes all validation rules
   - Any warnings noted
   - Ambiguities documented

5. **Deduplication Report** (if consolidating multiple sources)
   - Identical evidence recognized
   - Equivalent evidence marked
   - Cross-source conflicts flagged

### 11.2 What Business Genome Must NOT Assume

**Business Genome must NOT assume:**

✗ **Completeness:** Evidence IR contains all business facts
  - Evidence IR only contains discovered evidence
  - Organization may have undiscovered facts
  - Business logic cannot assume silence means evidence doesn't exist

✗ **Unambiguity:** All evidence is unambiguous
  - Evidence may be ambiguous (e.g., "IT handles some approvals")
  - Some evidence may refer to same fact with different phrasing
  - Business logic must handle ambiguity explicitly

✗ **Consistency:** Evidence is logically consistent
  - Evidence IR may contain contradictions (different sources say different things)
  - Contradictions must be explicitly resolved, not silently ignored
  - Business logic cannot assume consistency

✗ **Inference:** Evidence includes inference
  - Evidence IR contains only discovered facts
  - Inference is compiler responsibility
  - Business logic cannot assume inferred facts are in Evidence IR

✗ **Classification:** Evidence is classified by type
  - Evidence items have types (statement, description, etc.)
  - But these are form-types, not business semantic types
  - Business Genome assigns business classifications (decision, process, rule)

✗ **Scope Determination:** Scope is automatically determined
  - Evidence may lack clear scope (individual? team? organization?)
  - Scope may need inference from context
  - Business logic must handle scope ambiguity

✗ **Temporal Certainty:** Temporal markers are certain
  - Evidence marked "past", "present", "future"
  - But certainty may be ambiguous ("We used to do X, might still do it")
  - Business logic must handle temporal ambiguity

### 11.3 Evidence IR to Business Genome Mapping

**Evidence Items become Business Elements:**

```
Evidence Item (canonical form)
  ↓
Business Genome Element (with business semantics)

Examples:

Evidence: "I have authority to approve quotes under $5,000"
Becomes: Decision Rule (authorization)

Evidence: "I email customers daily and Robert handles technical questions"
Becomes: Process Steps (email, escalation)

Evidence: "Email is a bottleneck"
Becomes: Process Constraint (throughput issue)

Evidence: "We need better lead tracking"
Becomes: Requirement (system need)
```

**Mapping Principle:**

Evidence IR is neutral (no business semantics). Business Genome applies business logic to assign semantics. Multiple Evidence Items might contribute to single business element, or one Evidence Item might contribute to multiple elements.

### 11.4 Compiler Boundaries

**Evidence IR Compiler must NOT:**

✗ Implement business logic (Business Genome does)  
✗ Classify evidence by business type (Business Genome does)  
✗ Apply business rules (Business Genome does)  
✗ Make business decisions (Business Genome does)  
✗ Infer business semantics (Business Genome does)  

**Business Genome Compiler must NOT:**

✗ Modify Evidence IR (preserve evidence)  
✗ Discard evidence (preserve all discovered evidence)  
✗ Invent evidence (base conclusions on discovered evidence)  
✗ Assume evidence is complete (handle gaps explicitly)  
✗ Assume evidence is consistent (handle contradictions explicitly)  

### 11.5 Multi-Stage Compilation

**Full compilation pipeline:**

```
Stage 1: Discovery Engine
  Discovery Source → Discovery Evidence (100% text fidelity)

Stage 2: Evidence IR Compiler
  Discovery Evidence → Evidence IR (canonical, deduplicated)

Stage 3: Business Genome Compiler
  Evidence IR → Business Genome (business semantics applied)

Stage 4: Enterprise Blueprint
  Business Genome → Enterprise Blueprint (executable rules)

Stage 5: Runtime Generation
  Enterprise Blueprint → Generated Runtime (deployed system)
```

**Stage Responsibilities:**

- Stage 1: Text extraction, discovery structure
- Stage 2: Canonicalization, deduplication, versioning
- Stage 3: Business interpretation, decision extraction, process definition
- Stage 4: Rule synthesis, optimization, code generation
- Stage 5: Runtime implementation, deployment

**No Backpropagation:**

Each stage should not require information from later stages:
- Evidence IR should not need to know Business Genome semantics
- Business Genome should not need to know runtime implementation
- Stages can be updated independently

---

## 12. Architectural Invariants

Architectural Invariants are constraints that must hold at all times. They are immutable rules that apply to all Evidence IR processing.

### 12.1 Identity Invariants

**Invariant I1: Deterministic Identity**

```
Given identical source evidence E at times T1 and T2:
  ID_generated_at_T1(E) == ID_generated_at_T2(E)
  
This must always hold.
```

**Enforcement:** ID generation algorithm must be deterministic (content-based, not time-based)

**Compiler Use:** Compiler can rely on IDs being reproducible

---

**Invariant I2: Unique ID per Content**

```
Given two Evidence Items with identical content but different subjects:
  They must have different IDs
  (Subject is part of content hash)
  
Given two Evidence Items with identical content and identical subject:
  They must have identical ID
  (Deduplication detects this)
```

**Enforcement:** ID includes subject in hash calculation

**Compiler Use:** Compiler can deduplicate based on identity

---

**Invariant I3: Version Distinction**

```
Given Evidence Item v1 and Evidence Item v2 (same evidence, different version):
  ID_v1 != ID_v2
  (Version appended to ID)
  
Both versions must remain in Evidence IR.
```

**Enforcement:** Version number included in ID

**Compiler Use:** Compiler can track evidence evolution

---

### 12.2 Immutability Invariants

**Invariant I4: Evidence Immutability**

```
Given Evidence Item created at time T1:
  The Evidence Item content must not change
  
If evidence changes:
  New version must be created with new ID
  Original remains unchanged
```

**Enforcement:** Validation ensures no mutation of existing items

**Compiler Use:** Compiler can rely on evidence not changing

---

**Invariant I5: Provenance Immutability**

```
Given Evidence Item with provenance chain P1 → P2 → P3:
  The provenance chain must not be modified
  
New transformations add to chain (P1 → P2 → P3 → P4):
  Append-only, never delete
```

**Enforcement:** Audit trail verification

**Compiler Use:** Compiler can trust provenance chain

---

**Invariant I6: ID Immutability**

```
Given Evidence Item with ID X:
  The ID must not change
  
If content changes (new version):
  New ID created
  Original ID remains unchanged
```

**Enforcement:** No mutation of IDs in existing items

**Compiler Use:** Compiler can reference Evidence Items by ID

---

### 12.3 Canonicalization Invariants

**Invariant I7: Canonical Form Determinism**

```
Given Evidence E in non-canonical form:
  Canonicalize(E) produces form C1
  Canonicalize(E) produces form C2
  C1 == C2 (always identical)
```

**Enforcement:** Canonicalization algorithm must be deterministic

**Compiler Use:** Compiler can rely on canonical form being deterministic

---

**Invariant I8: Idempotent Canonicalization**

```
Given Evidence in canonical form C:
  Canonicalize(C) == C
  (Applying canonicalization to already-canonical form produces same form)
```

**Enforcement:** Canonicalization rules must be idempotent

**Compiler Use:** Compiler can canonicalize multiple times without effect

---

**Invariant I9: Semantics Preservation**

```
Given Evidence E:
  Original_Semantics(E) == Canonicalized_Semantics(E)
  
Canonicalization preserves meaning, never changes semantics.
```

**Enforcement:** Validator must verify semantic equivalence

**Compiler Use:** Compiler can trust canonical form is semantically equivalent

---

### 12.4 Deduplication Invariants

**Invariant I10: Identical Evidence Deduplication**

```
Given Evidence Item E1 from Source A and Evidence Item E2 from Source B:
  If ContentHash(E1) == ContentHash(E2):
    They represent identical evidence
    Only one canonical item in Evidence IR
    Both sources referenced in that item
```

**Enforcement:** Deduplication validation rule

**Compiler Use:** Compiler sees deduplicated evidence

---

**Invariant I11: Equivalence Recognition**

```
Given Evidence Items E1 and E2 with different phrasing but same meaning:
  If Canonicalize(E1) == Canonicalize(E2):
    They are recognized as equivalent
    Deduplication report marks as equivalent
    Compiler can choose to treat as single evidence
```

**Enforcement:** Deduplication rules with equivalence thresholds

**Compiler Use:** Compiler is aware of equivalent evidence

---

**Invariant I12: No Accidental Deduplication**

```
Given Evidence Items E1 and E2:
  If Deduplication marks them as equivalent:
    Human review required before treating as single evidence
  
  No automatic replacement of equivalent items
```

**Enforcement:** Deduplication report documents equivalences, compiler must act on them

**Compiler Use:** Compiler is not surprised by automatic deduplication

---

### 12.5 Provenance Invariants

**Invariant I13: Complete Provenance Chain**

```
Every Evidence Item must have unbroken chain back to source:
  Evidence IR Item
    ↓ references
  Discovery Evidence
    ↓ references
  Discovery Source
    ↓ references
  Original Interview Material

Every step must be traceable.
```

**Enforcement:** Validation requires complete provenance

**Compiler Use:** Compiler can audit any item back to source

---

**Invariant I14: Provenance Authenticity**

```
Provenance must accurately represent origin:
  stagel_provenance.discoveryInterviewId must match actual interview ID
  discovery_metadata.participant must match actual participant
  Timestamps must be accurate
  References must be valid
```

**Enforcement:** Validator cross-checks provenance accuracy

**Compiler Use:** Compiler can trust provenance is accurate

---

**Invariant I15: Lineage Preservatio**

```
Given compilation from Evidence IR to Business Genome:
  Every Business Genome item must trace back to Evidence IR
  Every Evidence IR item must be referenceable by Business Genome
  Traceability is bidirectional
```

**Enforcement:** Compiler must maintain traceability map

**Compiler Use:** Compiler output is auditable back to source

---

### 12.6 Validation Invariants

**Invariant I16: Validation Comprehensiveness**

```
Given Evidence Item:
  If it passes validation:
    ALL required fields are present
    ALL field values are valid types
    ALL references are valid
    ALL provenance is complete
    ID is deterministic
    Canonical form is correct
  
  If it fails validation:
    At least one required field is missing or invalid
```

**Enforcement:** Validation rules must be comprehensive

**Compiler Use:** Compiler knows validated evidence is complete

---

**Invariant I17: Non-Destructive Validation**

```
Given Evidence Item:
  Validation(Item) produces validation result
  Item is unchanged by validation
  
Validation never modifies evidence, only reports on it.
```

**Enforcement:** Validation rules cannot modify evidence

**Compiler Use:** Compiler can validate repeatedly without changing evidence

---

**Invariant I18: Deterministic Validation**

```
Given Evidence Item:
  Validate(Item) at time T1 produces result R1
  Validate(Item) at time T2 produces result R2
  R1 == R2 (always identical)
  
Validation results are deterministic.
```

**Enforcement:** Validation rules must be deterministic

**Compiler Use:** Compiler knows validation is reproducible

---

### 12.7 Atomicity Invariants

**Invariant I19: Evidence Item Atomicity**

```
Given Evidence Item:
  It represents single, indivisible fact
  It cannot be split into smaller items and preserve meaning
  It cannot be aggregated with other items and preserve specificity
  
Atomicity is verified during import.
```

**Enforcement:** Item validation includes atomicity check

**Compiler Use:** Compiler knows items are truly atomic

---

**Invariant I20: No Silent Discards**

```
Given discovery evidence:
  Every piece of evidence becomes Evidence Item(s)
  Nothing is silently discarded
  No evidence loss in transformation
  
Completeness is verified during import.
```

**Enforcement:** Import validator checks for evidence loss

**Compiler Use:** Compiler knows all evidence is preserved

---

---

## 13. Versioning Strategy

Evidence IR is versioned to support long-term evolution and schema changes while maintaining backward compatibility and auditability.

### 13.1 Versioning Levels

**Three levels of versioning:**

1. **Schema Version** - Version of Evidence IR specification (e.g., 1.0, 1.1, 2.0)
2. **Evidence Version** - Version of specific Evidence Item (e.g., v1, v2, when evidence is corrected)
3. **Package Version** - Version of Evidence Package (incremented when contents change)

### 13.2 Schema Versioning

**Schema Version Format:**

```
Evidence-IR-<Major>.<Minor>

Examples:
  Evidence-IR-1.0  (first release)
  Evidence-IR-1.1  (minor update, backward compatible)
  Evidence-IR-2.0  (major update, may require migration)
```

**Version Semantics:**

**Major Version Change (X.0 → Y.0):**
- New required fields added
- Required fields removed (deprecated)
- Fundamental changes to model
- Requires explicit migration
- Old version still supported (with migration path)

**Minor Version Change (X.Y → X.Z, where Z > Y):**
- New optional fields added
- Clarifications to specification
- Bug fixes in semantics
- Backward compatible (old Evidence IR valid in new version)
- No migration required

**Bug Fix Version Change (X.Y.Z → X.Y.W):**
- Clarifications to specification
- Documentation updates
- No changes to Evidence IR format
- No migration needed

### 13.3 Evidence Item Versioning

**When Evidence Item Version Increments:**

Evidence v1 → Evidence v2 when evidence is:
- **Corrected:** Factual error in original discovery
- **Clarified:** Original was ambiguous, clarification provided
- **Updated:** What was true no longer applies; update reflects current state

**When Version Does NOT Increment:**

Version does NOT change when:
- Evidence is recognized as duplicate (deduplicated, not versioned)
- Evidence is recognized as equivalent (equivalence tracked, not versioned)
- Evidence is rephrased without semantic change (canonicalize, don't version)
- Provenance or metadata is added (add metadata, don't version)

**Version ID Format:**

```
evidence_<contentHash>_v<number>

Examples:
  evidence_a7f3c2e91b_v1  (original)
  evidence_a7f3c2e91b_v2  (updated)
  evidence_a7f3c2e91b_v3  (further updated)
```

**Version Chain:**

```
evidence_XXX_v1 (Original discovery)
  ↓ corrected to
evidence_XXX_v2 (Correction applied)
  ↓ updated to
evidence_XXX_v3 (Information updated)
  ↓
evidence_XXX_vN (Latest version)
```

All versions remain in Evidence IR. Compiler chooses which version to use.

### 13.4 Migration Strategy

**Migration Path for Schema Updates:**

When Evidence IR schema changes (e.g., 1.0 → 1.1):

1. **Specification Phase**
   - Document new schema requirements
   - Document migration rules
   - Provide migration examples
   - Publish specification

2. **Transition Phase**
   - Both versions accepted (1.0 and 1.1)
   - Migration tools provided
   - Dual validation (validate against both schemas)
   - Deprecation notice for 1.0

3. **Migration Phase**
   - Users migrate existing Evidence IR from 1.0 → 1.1
   - Migration tools automated
   - Manual review for any ambiguities
   - Updated validation rules applied

4. **Sunset Phase**
   - Evidence IR 1.0 no longer accepted for new evidence
   - Legacy 1.0 evidence remains valid with migration wrapper
   - Compiler supports both with explicit version declaration
   - Deprecated version eventually removed (with long notice)

### 13.5 Compatibility Rules

**Backward Compatibility Guarantee:**

```
Evidence IR created under Schema 1.0 must remain valid in Schema 1.1, 1.2, etc.
```

**Forward Compatibility:**

```
Evidence IR created under Schema 1.1 may NOT be valid in Schema 1.0
(backward compatible, not forward compatible)
```

**Migration Guarantee:**

```
Evidence IR Schema 1.0 → 1.1 transformation must preserve evidence:
  Migrate(EvidenceIR_1.0) produces EvidenceIR_1.1
  Semantics preserved (same evidence, same meaning)
  Provenance preserved (all source references maintained)
  No evidence loss
```

### 13.6 Compiler Version Declaration

**Compiler must declare:**

Which Evidence IR schema version it requires:

```
CompilerRequirement:
  schemaVersion: "Evidence-IR-1.0"
  minimumVersion: "Evidence-IR-1.0"
  maximumVersion: "Evidence-IR-2.0"
```

Compiler output must declare which Evidence IR version was used:

```
CompilerOutput:
  sourceEvidenceIRVersion: "Evidence-IR-1.0"
  usedEvidence: [
    {
      id: "evidence_abc_v1"
      evidenceIRVersion: "Evidence-IR-1.0"
    },
    ...
  ]
```

---

## 14. Extension Strategy

Evidence IR is designed to support future expansion without fundamental architectural change. This section defines how new evidence types and sources can be integrated.

### 14.1 New Evidence Types

**Principle:** New evidence types can be added without modifying existing Evidence Items.

**Current Evidence Types (Evidence IR 1.0):**

```
- statement         (described fact)
- assertion         (claimed truth)
- description       (role, responsibility, activity description)
- constraint        (boundary condition)
- decision          (decision or decision authority)
- pain_point        (identified problem)
- capability        (existing capability or tool)
- need              (expressed need or desired capability)
- measurement       (quantified observation)
- interaction       (interaction pattern)
- obstacle          (identified barrier)
- opportunity       (improvement opportunity)
```

**Adding New Evidence Type (Example):**

Suppose we discover a need for "metric" evidence type:

```
Proposal:
  new type: "metric"
  definition: "Measurable value with target or threshold"
  example: "SLA requires <2 hour response time"
  
Specification Change:
  Update EvidenceType enum to include "metric"
  Define validation rules for metric evidence
  Define mapping rules to Business Genome
  Update specification to Evidence-IR-1.1
  
Backward Compatibility:
  Existing Evidence IR 1.0 valid in 1.1 (metric is optional)
  Existing evidence types unchanged
  
Migration:
  If discovering new metrics, use metric type
  Old "statement" evidence describing metrics still valid
```

**Extension Requirements:**

✓ New types don't require changes to existing Evidence Items  
✓ Validation rules defined for new types  
✓ Mapping rules to Business Genome defined  
✓ Schema version incremented (minor or major as appropriate)  
✓ Backward compatibility maintained  

### 14.2 New Evidence Sources

**Principle:** Evidence can come from multiple discovery sources without requiring Evidence IR changes.

**Current Sources (Evidence IR 1.0):**

- Discovery Interviews (Stage 1, PDF-based)
- Discovery Questions/Answers (Interview methodology)

**Adding New Source: Email Evidence (Hypothetical)**

```
Proposal:
  new source: "email"
  process: Analyze organizational email corpus for business evidence
  example evidence: Process flows, decision patterns, authorization, pain points
  
Implementation:
  Stage 3 (Email Importer) extracts evidence from emails
  Produces Discovery Evidence (similar to Stage 1)
  Evidence IR Compiler processes into Evidence Items
  Same canonicalization, deduplication, validation rules apply
  
Specification Impact:
  No changes to Evidence Item model
  No changes to validation rules
  New source reference type added to provenance
  
Example Evidence Item from email:
  stage1_provenance:
    discoverySourceId: "src_email_2026_payroll_process"
    discoveryDocumentId: "doc_email_corpus_v1"
    emailIds: ["email_1234", "email_5678", ...]
  discovery_metadata:
    sourceType: "email_corpus"
    timeRange: "2026-01-01 to 2026-07-09"
    sender: "financial-team@company.com"
```

**Adding New Source: Document Analysis (Hypothetical)**

```
Proposal:
  new source: "documents"
  process: Analyze business documents (processes, policies, procedures)
  example evidence: Process definitions, authorization rules, constraints
  
Implementation:
  Stage 3 (Document Importer) extracts evidence from documents
  Produces Discovery Evidence
  Evidence IR Compiler processes normally
  
Example Evidence Item from document:
  stage1_provenance:
    discoverySourceId: "src_document_sales_procedures_v3"
    documentId: "doc_sales_procedures"
    documentType: "procedure_manual"
    section: "5.2 - Approval Process"
    pageNumber: 12
```

**Extension Requirements:**

✓ New sources don't require changes to Evidence Item model  
✓ Discovery process (Stage 1 equivalent) produces same format  
✓ Same Evidence IR canonicalization rules apply  
✓ Provenance clearly identifies source type  
✓ Evidence from different sources can be consolidated  
✓ No schema changes required (new sources work with Evidence-IR-1.0)  

### 14.3 New Collection Types

**Principle:** New Collection scopes can be defined without modifying Evidence Items.

**Current Collection Scopes (Evidence IR 1.0):**

```
- person         (evidence about a specific person)
- role           (evidence about a role)
- team           (evidence about a team)
- process        (evidence about a process)
- system         (evidence about a system)
- problem        (evidence about a problem)
- domain         (evidence about a domain)
```

**Adding New Scope: Event Collection (Hypothetical)**

```
Proposal:
  new scope: "event"
  definition: "Evidence about a specific business event or incident"
  example: "Product launch event", "Server outage incident"
  
Implementation:
  New collection scope added to enum
  Collections can group event-related evidence
  Same Collection validation rules apply
  No Evidence Item changes required
  
Example Collection:
  id: "collection_abc123_event_launch_product_x"
  scope: "event"
  title: "Product X Launch Event"
  items: [Evidence Items related to launch]
```

**Extension Requirements:**

✓ New scopes don't require changes to Evidence Items  
✓ Validation rules for new scopes defined  
✓ Collection organization unchanged  
✓ Compiler can treat new scopes appropriately  

### 14.4 New Relationship Types

**Principle:** New relationship types can be defined without modifying Evidence Items.

**Current Relationships (Evidence IR 1.0):**

```
- same_topic         (describes same topic)
- contradicts        (conflicts with)
- supports           (corroborates)
- extends            (adds detail to)
- clarifies          (explains)
- references         (mentions)
- part_of            (part of larger unit)
- instance_of        (instance of pattern)
```

**Adding New Relationship: Depends On (Hypothetical)**

```
Proposal:
  new relationship: "depends_on"
  definition: "One evidence depends on or requires another evidence"
  example: "Process X depends on System Y being operational"
  
Implementation:
  New relationship type added to enum
  Evidence relationships can include depends_on
  Compiler recognizes dependency relationships
  Same relationship validation rules apply
  No Evidence Item changes required
  
Example:
  evidence_item_1:
    statement: "Run daily reports"
    relationships:
      depends_on: [evidence_item_2]
  
  evidence_item_2:
    statement: "Database is operational"
```

**Extension Requirements:**

✓ New relationships don't require model changes  
✓ Semantics defined clearly  
✓ Validation rules defined  
✓ Compiler can use relationships for reasoning  

### 14.5 Future Extension Examples

**Evidence from Audio/Video:**

```
Stage 3 (Audio Importer) analyzes business meetings, calls
Produces transcripts → Discovery Evidence → Evidence Items
Same Evidence IR model works
Provenance: includes audio source reference, timestamp
No model changes required
```

**Evidence from Chat/Messaging:**

```
Stage 3 (Chat Importer) analyzes team communication
Produces structured evidence from chat threads
Same Evidence Items format
Provenance: includes chat source, user, timestamp
No model changes required
```

**Evidence from Forms/Surveys:**

```
Stage 3 (Form Importer) processes structured questionnaires
Produces Evidence Items from form responses
Same validation, canonicalization rules
Provenance: includes form response ID, respondent
No model changes required
```

**Evidence from API Integration:**

```
Stage 3 (API Importer) ingests data from business systems
CRM data, ERP data, HR systems provide evidence
Evidence Items extracted from system data
Provenance: includes system source, API version
No model changes required
```

### 14.6 Extension Governance

**Requirements for Adding New Features:**

1. **Specification Update**
   - Document new type/source/scope/relationship
   - Provide examples
   - Define validation rules
   - Update architecture document
   - Increment schema version

2. **Backward Compatibility**
   - Ensure existing Evidence IR remains valid
   - No breaking changes to Evidence Item model
   - Optional fields only (not required fields)
   - Schema version indicates compatibility

3. **Validation Rules**
   - Define what makes new type/source valid
   - Ensure new rules don't break existing evidence
   - Document rule priority and precedence

4. **Compiler Updates**
   - Update compiler to handle new types/sources
   - Define mapping rules to Business Genome
   - Test with new evidence types

5. **Migration Path**
   - If major change, define migration rules
   - Provide migration tools
   - Document deprecated features

---

## 15. Open Questions

This section documents architectural questions that remain unresolved and should be addressed in future specification updates or during implementation.

### 15.1 Ambiguity Resolution

**Question 1: Automatic vs. Human-Guided Deduplication**

```
When Evidence IR encounters equivalent evidence from different sources
with minor phrasing differences, should:

  Option A: Automatically deduplicate (compiler chooses one representation)
  Option B: Flag for human review before deduplication
  Option C: Present both versions to Business Genome for decision

Current Spec: Flags for recognition, compiler applies business rules

Open: Should Evidence IR include recommendation for compiler?
```

**Question 2: Scope Ambiguity**

```
When evidence doesn't clearly indicate scope (individual vs. team vs. org):

  Option A: Mark as "ambiguous_scope", compiler must infer
  Option B: Assume individual scope unless explicitly stated
  Option C: Require scope inference during import
  
Current Spec: Mark scope explicitly, compiler infers if needed

Open: Should there be default scope assumption?
```

**Question 3: Temporality Inference**

```
When source evidence doesn't clearly indicate temporality
("We handle customer support" - is this ongoing? past? future?):

  Option A: Require explicit temporality from discovery
  Option B: Infer from context (recent interview → present tense)
  Option C: Mark as ambiguous, compiler infers

Current Spec: Explicit temporality field, mark unknown if ambiguous

Open: How much inference is appropriate in import phase?
```

### 15.2 Compiler Interaction

**Question 4: Compiler Responsibility for Conflicts**

```
When Business Genome compiler encounters contradictory evidence:

  Option A: Compiler must resolve (e.g., choose most recent)
  Option B: Compiler must fail with error
  Option C: Compiler marks contradiction in output, continues

Current Spec: Mark conflicts, require explicit resolution

Open: Should Evidence IR provide hints for resolution strategy?
```

**Question 5: Inference Limits**

```
What inference is Business Genome allowed to perform from Evidence IR?

  Option A: Only direct mapping (evidence → business element)
  Option B: Limited inference (recognize equivalent evidence)
  Option C: Full inference (synthesize higher-order conclusions)

Current Spec: Inference is allowed, must be documented

Open: Should Evidence IR specify inference boundaries?
```

### 15.3 Scale and Performance

**Question 6: Large-Scale Consolidation**

```
When consolidating Evidence from 100+ interviews:

  Option A: Single Evidence Set with all packages
  Option B: Hierarchical Evidence Sets (Zach + Madison → Set1, etc.)
  Option C: Federated Evidence (separate packages, consolidated on demand)

Current Spec: Single or multiple packages, compiler manages scale

Open: What's the practical limit for Evidence IR size?
```

**Question 7: Real-Time Evidence Updates**

```
If business processes continuously feed evidence (sensor data, live events):

  Option A: Batch evidence into packages periodically
  Option B: Stream individual evidence items as received
  Option C: Mix (some batch, some streaming)

Current Spec: Package-based, static import

Open: Should Evidence IR support continuous streaming?
```

### 15.4 Semantic Precision

**Question 8: Subject Disambiguation**

```
When evidence mentions subject ambiguously ("It" in "It needs updating"):

  Option A: Require explicit subject identification during import
  Option B: Support ambiguous subjects with reference resolution rules
  Option C: Mark ambiguous, compiler resolves

Current Spec: Include ambiguous reference with full context

Open: What disambiguation techniques should be standard?
```

**Question 9: Measurement Precision**

```
When evidence contains measurements ("About 100 emails per day"):

  Option A: Exact precision (100)
  Option B: Range precision (95-105)
  Option C: Natural language precision ("about 100")

Current Spec: Preserve natural language, compiler interprets

Open: Should Evidence IR extract structured measurements?
```

### 15.5 Multi-Language and Localization

**Question 10: Non-English Evidence**

```
If Evidence IR must support multiple languages:

  Option A: All evidence translated to canonical language (e.g., English)
  Option B: Original language preserved, translations provided
  Option C: Evidence stored in original language, compiler handles localization

Current Spec: English-focused, assumes UTF-8 encoding

Open: What's the localization strategy for multi-national enterprise?
```

### 15.6 Regulatory and Compliance

**Question 11: Evidence Retention**

```
How long must Evidence IR be retained?

  Option A: Forever (permanent record)
  Option B: Per organizational policy (e.g., 7 years)
  Option C: Until superseded by newer evidence

Current Spec: Immutable, versioned, no deletion

Open: Should Evidence IR support evidence expiration/archival?
```

**Question 12: Evidence Redaction**

```
If sensitive information must be redacted (personal data, secrets):

  Option A: Remove evidence entirely
  Option B: Redact specific fields, preserve rest
  Option C: Flag as sensitive, compiler handles redaction

Current Spec: All evidence preserved, provenance immutable

Open: How should Evidence IR handle regulatory redaction requirements?
```

### 15.7 Future Extensibility

**Question 13: Machine Learning Inference**

```
Should Evidence IR support ML-based evidence inference?

  Option A: ML results stored as separate evidence type
  Option B: ML inferences marked explicitly as non-original
  Option C: No ML in Evidence IR (Business Genome layer)

Current Spec: No ML, inference is Business Genome responsibility

Open: Is ML appropriate at Evidence IR level?
```

**Question 14: Continuous Evidence Learning**

```
If compiler generates feedback that improves evidence understanding:

  Option A: Feedback updates Evidence IR (new version)
  Option B: Feedback stored separately (metadata)
  Option C: Feedback feeds into next discovery phase

Current Spec: Feedback external to Evidence IR

Open: Should Evidence IR support closed-loop learning?
```

---

## 16. Architecture Assessment

This section provides a formal assessment of Evidence IR architecture against key criteria.

### 16.1 Clarity Assessment

**Criterion: Are specifications clear and unambiguous?**

✓ **PASS - Strong Clarity**

- Evidence model is well-defined with examples
- Identity rules are explicit (no ambiguity)
- Validation requirements are specific
- Relationship to Discovery and Business Genome is clear
- Architectural principles are stated as invariants

**Areas of Excellence:**
- Proof by example (multiple evidence mapping examples)
- Explicit boundary definitions (what is/isn't responsibility)
- Clear role definitions (Stage 1 vs. Stage 2 vs. Stage 3)

**Improvement Opportunities:**
- More formal notation could enhance precision (e.g., BNF for ID format)
- Edge cases could be documented more thoroughly
- Decision matrices could clarify ambiguity resolution

**Grade: A-**

### 16.2 Determinism Assessment

**Criterion: Can Evidence IR guarantee deterministic compilation?**

✓ **PASS - Strong Determinism**

- ID generation is content-based, not time-based
- Canonicalization rules are deterministic
- Validation is deterministic
- Provenance is immutable (reproducible lineage)
- Schema is versioned (deterministic across versions)

**Areas of Excellence:**
- Determinism invariants (I1-I18) formalize guarantees
- ID generation includes scope/subject (prevents accidental collisions)
- Canonicalization is idempotent

**Improvement Opportunities:**
- Canonicalization rules could be more formal (BNF or pseudocode)
- Determinism proof of concept needed (formal verification)
- Edge cases in canonicalization need more specification

**Grade: A**

### 16.3 Auditability Assessment

**Criterion: Can Evidence IR audit trail be complete and verifiable?**

✓ **PASS - Strong Auditability**

- Provenance chain is immutable and complete
- Every evidence item traces to source
- Processing history is recorded
- Validation history is maintained
- Evidence versions are tracked

**Areas of Excellence:**
- Append-only provenance model (forensically sound)
- Complete source lineage requirements
- Transformation history captures reasoning
- Identity preservation enables backward tracing

**Improvement Opportunities:**
- Formal audit query language could aid implementation
- Audit report format could be standardized
- Cross-system audit requirements need clarification

**Grade: A-**

### 16.4 Compiler Suitability Assessment

**Criterion: Is Evidence IR suitable for compiler implementation?**

✓ **PASS - Strong Compiler Suitability**

- Contract clearly defines compiler responsibilities
- Non-ambiguous input (canonical, deduplicated)
- Deterministic requirements enable reproducible compilation
- Error handling is explicitly specified
- Inference limitations are clear

**Areas of Excellence:**
- Clear boundary between Evidence IR and Business Genome
- Failure modes are explicitly documented
- Conflict detection and reporting requirements are specific
- Output traceability requirements support compiler verification

**Improvement Opportunities:**
- Compiler algorithm examples could clarify expectations
- Performance characteristics not specified (scalability hints needed)
- Extensibility mechanisms could be more formal

**Grade: A-**

### 16.5 Extensibility Assessment

**Criterion: Can Evidence IR extend without fundamental changes?**

✓ **PASS - Strong Extensibility**

- New evidence types can be added (extension strategy defined)
- New sources can be added (generic provenance model)
- New collection scopes can be added (enumeration, not restricted model)
- New relationships can be added (extensible relationship graph)
- Backward compatibility maintained through versioning

**Areas of Excellence:**
- Extension examples show concrete use cases
- Backward compatibility strategy is clear
- Schema versioning supports evolution
- Model is generic enough for diverse evidence types

**Improvement Opportunities:**
- Plugin architecture for new types could be more formal
- Validation rule inheritance for new types needs specification
- Migration path for major extensions needs more detail

**Grade: B+**

### 16.6 Long-Term Stability Assessment

**Criterion: Will Evidence IR remain stable and understandable for decades?**

✓ **PASS - Strong Stability**

- Immutability prevents accidental modifications
- Versioning supports long-term evolution
- Provenance is self-contained (doesn't depend on external systems)
- Standards-compliant formats (ISO 8601 dates, UTF-8 encoding)
- Schema is documented in human-readable form

**Areas of Excellence:**
- Immutable provenance ensures historical accuracy
- Independent versioning of each layer (not tied to technology versions)
- Self-documenting structure (IDs include purpose, fields are named clearly)
- No dependency on specific implementations

**Improvement Opportunities:**
- Formal archival and preservation strategy needed
- File format stability requirements not specified
- Long-term compatibility requirements unclear
- Digital preservation requirements not addressed

**Grade: B+**

### 16.7 Enterprise Scalability Assessment

**Criterion: Can Evidence IR support enterprise-scale evidence collection?**

⚠ **PASS with CONCERN - Moderate Scalability**

- Model supports large evidence counts (deterministic IDs enable indexing)
- Modular structure (packages/sets) supports distributed collection
- Deduplication enables consolidation
- But: Scale limits not specified, performance characteristics not addressed

**Areas of Excellence:**
- Hierarchical structure (items → collections → packages → sets) enables organization
- Deduplication reduces duplication as scale increases
- Immutability enables caching/indexing strategies
- Deterministic IDs enable content-addressed storage

**Improvement Opportunities:**
- Scale targets not specified (10K items? 1M items? 1B items?)
- Performance requirements not documented
- Distributed compilation strategy unclear
- Sharding/partitioning strategy for large datasets not addressed
- Query patterns not specified (enabling optimization)

**Grade: B**

---

## Conclusion

**Evidence IR 1.0 is ready for formal Architecture Review (RAR → ARD → ADR).**

### Summary Assessment

| Criterion | Grade | Comments |
|-----------|-------|----------|
| **Clarity** | A- | Well-defined, some edge cases need specification |
| **Determinism** | A | Determinism invariants strongly specified |
| **Auditability** | A- | Complete provenance model, formal audit language needed |
| **Compiler Suitability** | A- | Clear contract, implementation guidance helpful |
| **Extensibility** | B+ | Multiple extension paths, more formalism needed |
| **Long-Term Stability** | B+ | Immutable design, preservation strategy needed |
| **Enterprise Scalability** | B | Modular design, scale limits not specified |
| **Overall** | A- | Architecture is sound, specification is comprehensive |

### Recommendation for Implementation

✓ **READY FOR ARCHITECTURE REVIEW**

Evidence IR 1.0 specification is complete and suitable for formal Architecture Review Board process.

**Next Steps:**

1. **Architecture Review** (RAR - Request for Architecture Review)
   - Present specification to review board
   - Gather feedback on principles and invariants
   - Identify any missing requirements

2. **Architecture Decision Record** (ADR - Architecture Decision Record)
   - Document decisions made in specification
   - Record alternative approaches considered
   - Explain rationale for chosen approach

3. **Implementation Specification** (before implementation begins)
   - Define canonicalization algorithms formally
   - Specify ID generation implementation
   - Define validation rule precedence
   - Document compiler interface specification

4. **Production Readiness** (before Stage 2 implementation)
   - Formal specification review by enterprise architecture
   - Compliance verification against standards
   - Performance target definition
   - Scale target definition

### Open Items for Review Board

1. **Canonicalization Formality**
   - Specification examples provided; formal grammar needed?

2. **Scale Targets**
   - What's the target scale (items, collections, sets)?

3. **Multi-Language Support**
   - Is international enterprise support needed?

4. **Regulatory Requirements**
   - Evidence retention and redaction policies?

5. **Extension Governance**
   - Who decides on new evidence types/sources?

---

**Document Prepared By:** Genesis Architecture Team  
**Date:** July 9, 2026  
**Status:** Architecture Review Draft  
**Next Review:** After Architecture Review Board feedback

---

## Appendix A: Evidence Item Example

```
Evidence Item Example:
{
  "id": "evidence_c7a9f2b3_v1",
  "schemaVersion": "1.0",
  "contentHash": "c7a9f2b3e1d5f8a4b6c9e2f3d7a1b4c8",
  
  "type": "decision",
  "statement": "I have authority to approve customer quotes under $5,000",
  "context": "Madison described her decision authority regarding pricing",
  "qualifier": "individual_current",
  
  "metadata": {
    "subject": "Quote Authorization",
    "subjects": ["Quote Authorization", "Pricing", "Decision Authority"],
    "scope": "individual",
    "temporality": "present"
  },
  
  "relationships": {
    "same_topic": ["evidence_abc_v1", "evidence_def_v2"],
    "related": ["evidence_ghi_v1"],
    "constrains": ["evidence_jkl_v1"]
  },
  
  "provenance": {
    "stage1_provenance": {
      "discoverySourceId": "src_madison_real_discovery_interview",
      "discoveryDocumentId": "doc_madison_real",
      "discoveryInterviewId": "interview_45da4e58",
      "questionNumber": 7,
      "answerText": "[Madison's answer about decision authority]",
      "pageNumber": 1,
      "characterRange": [2341, 2450],
      "stage1Version": "1.0",
      "stage1ProcessedAt": "2026-07-09T10:30:00Z"
    },
    
    "discovery_metadata": {
      "interviewDate": "2026-07-08",
      "participant": "Madison",
      "participantRole": "Operations Manager",
      "participantDepartment": "Operations",
      "interviewer": "Robert Stoner"
    },
    
    "evidence_import": {
      "importedAt": "2026-07-09T12:00:00Z",
      "importedBy": "genesis-discovery-stage1-ir-compiler",
      "importVersion": "1.0",
      "processingPipeline": "Stage1ToEvidenceIR"
    },
    
    "transformations": [
      {
        "operation": "canonicalization",
        "timestamp": "2026-07-09T12:00:00Z",
        "rulesApplied": ["normalize_whitespace", "sort_references"],
        "inputHash": "abc123",
        "outputHash": "c7a9f2b3e1d5f8a4b6c9e2f3d7a1b4c8"
      }
    ],
    
    "validations": [
      {
        "validationTime": "2026-07-09T12:00:00Z",
        "validationVersion": "1.0",
        "validationResult": "VALID",
        "errors": [],
        "warnings": []
      }
    ]
  }
}
```

---

**END OF SPECIFICATION**

