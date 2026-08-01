# Compiler Conformance Specification

## Normative Conformance Model
A compiler is conforming only if all mandatory GCS-0001 requirements are satisfied.

## Normative Conformance Evidence
Conformance evidence MUST include:
- required test fixtures
- expected compiler outputs
- replay validation results
- determinism validation results
- certification validation results
- manifest validation results

## Normative Fixture Requirements
- Fixtures MUST include controlled evidence inputs and expected normative outputs.
- Fixtures MUST include rule set versions and manifest expectations.
- Fixtures MUST include at least one snapshot and one delta validation case.

## Normative Cross-Language Requirement
Compilers implemented in TypeScript, Rust, Go, C#, Java, C++, Python, or future languages MUST produce identical normative outputs for identical normative inputs.

## Normative Compliance Decision
- PASS: all required validations satisfied.
- FAIL: one or more required validations not satisfied.

## Informative Guidance
Tooling for executing conformance tests is implementation-defined.
