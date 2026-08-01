# Certification Specification

## Normative Certification Scope
Certification verifies conformance to GCS-0001 normative requirements.

## Normative Certification Requirements
Certification MUST validate:
- lifecycle conformance
- pipeline and pass conformance
- IBR and instruction conformance
- entity, relationship, rule, and assembly conformance
- output and manifest conformance
- determinism conformance
- replay conformance

## Normative Certification States
- NOT_STARTED
- IN_REVIEW
- CERTIFIED
- CERTIFIED_WITH_CONDITIONS
- REJECTED

## Normative Blocking Conditions
Certification MUST be rejected when:
- determinism law fails
- replay contract fails
- required outputs or manifests are missing
- provenance is incomplete
- immutable artifact guarantees are violated

## Informative Guidance
Certification processes may be run by independent teams as long as normative decision criteria are preserved.
