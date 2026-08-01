# Compiler Manifest Specification

## Normative Requirements
A compiler manifest MUST include:
- compiler execution identifier
- compiler version
- specification version
- rule set version(s)
- input artifact references
- output artifact references
- lifecycle status
- determinism assertion fields
- replay manifest reference
- certification record reference

## Normative Validation
- Manifest references MUST resolve.
- Manifest content MUST be immutable once execution state is COMPLETED.
- Manifest content MUST be sufficient to support conformance checks.

## Informative Guidance
The manifest is the normative execution envelope for auditability and reproducibility.
