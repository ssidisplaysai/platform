# Genesis Compiler Specification

## 1. Purpose

### 1.1 Normative Requirements
- A conforming Genesis Compiler MUST implement the normative requirements defined in GCS-0001.
- A conforming Genesis Compiler MUST produce required normative outputs and manifests.
- A conforming Genesis Compiler MUST preserve determinism, replayability, immutability, auditability, versioning, and certification readiness.
- A conforming Genesis Compiler MUST be implementation independent with respect to output behavior.

### 1.2 Informative Guidance
This document is the root normative contract for all subordinate GCS-0001 specifications.

## 2. Compiler Definition

### 2.1 Normative Requirements
A Genesis Compiler is a governed transformation system that:
- MUST consume governed evidence-derived and architecture-defined inputs.
- MUST transform those inputs through a defined pipeline and pass model.
- MUST produce Business Genome outputs, ledgers, and manifests defined by this specification.
- MUST NOT invent evidence or canonical business facts not derivable from governed inputs.

### 2.2 Informative Guidance
The compiler composes outputs from WS-I through WS-IIIE architecture contracts under this normative standard.

## 3. Required Normative Outputs

### 3.1 Normative Requirements
A conforming compiler MUST produce:
- Business Genome Snapshot
- Business Genome Delta
- Compiler Manifest
- Replay Manifest
- Certification Record
- Identity Ledger
- Relationship Ledger
- Rule Ledger
- Assembly Manifest
- Publication Manifest

### 3.2 Informative Guidance
Output-specific structures are further constrained in dedicated specification documents.

## 4. Normative Prohibitions

### 4.1 Normative Requirements
A conforming compiler MUST NOT:
- mutate prior immutable records
- emit outputs without provenance lineage
- omit required manifest references
- alter deterministic outcomes for identical normative inputs
- rely on implementation language behavior that changes normative outputs

### 4.2 Informative Guidance
These prohibitions protect cross-language conformance and constitutional traceability.

## 5. Specification Binding

### 5.1 Normative Requirements
The following GCS-0001 subordinate documents are normative and binding:
- Compiler-Lifecycle-Specification.md
- Compiler-Pipeline-Specification.md
- Compiler-Pass-Specification.md
- IBR-Specification.md
- Compiler-Instruction-Specification.md
- Entity-Resolution-Specification.md
- Relationship-Resolution-Specification.md
- Business-Rule-Specification.md
- Business-Genome-Assembly-Specification.md
- Compiler-Manifest-Specification.md
- Business-Genome-Output-Specification.md
- Determinism-Specification.md
- Replay-Specification.md
- Compiler-Conformance-Specification.md
- Certification-Specification.md
- Versioning-and-Compatibility.md

### 5.2 Informative Guidance
Compiler-Terminology.md and Glossary.md support interpretation and consistency.
