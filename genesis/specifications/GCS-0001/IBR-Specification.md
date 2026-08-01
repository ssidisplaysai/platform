# IBR Specification

## 1. Normative Definition
IBR (Intermediate Business Representation) is the canonical intermediate representation used between compiler passes.

## 2. Normative IBR Requirements
- IBR artifacts MUST be immutable.
- IBR artifacts MUST include deterministic identity.
- IBR artifacts MUST include provenance references to source artifacts.
- IBR artifacts MUST include version references: compiler version, rule set version, specification version.

## 3. Normative IBR Content Classes
IBR MUST support representation of:
- canonical entity facts
- canonical relationship facts
- rule evaluation results
- assembly-relevant knowledge references

## 4. Normative IBR Validity
- IBR artifacts MUST conform to compiler pass precondition contracts.
- Invalid IBR artifacts MUST fail conformance and certification checks.

## Informative Guidance
IBR structure shape may vary per implementation provided all normative fields and guarantees are preserved.
