# Compiler Pipeline Specification

## 1. Normative Pipeline Contract
A conforming compiler MUST define a deterministic pipeline that processes governed inputs into governed outputs.

## 2. Normative Pipeline Requirements
- Pipeline stages MUST have explicit input and output contracts.
- Stage ordering MUST be deterministic.
- Stage boundaries MUST preserve provenance.
- Stage transitions MUST enforce manifest and version consistency.
- A stage MUST NOT consume undefined or uncertified upstream artifacts.

## 3. Normative Pipeline Inputs
- Canonical Entities
- Canonical Relationships
- Validated Facts
- Rule Results
- Evidence References
- Identity, Relationship, and Rule Ledgers
- Compiler Manifest
- Replay Manifest

## 4. Normative Pipeline Outputs
- Business Genome Snapshot
- Business Genome Delta
- Canonical Entity Graph
- Canonical Relationship Graph
- Knowledge Graph
- Evidence Trace Graph
- Updated ledgers and manifests as specified

## 5. Normative Boundary Guarantees
- Every stage output MUST be immutable.
- Every stage output MUST include provenance links.
- Every stage output MUST be replay-reproducible for identical inputs and versions.

## Informative Guidance
Pipeline topology may vary by implementation as long as normative contracts are satisfied.
