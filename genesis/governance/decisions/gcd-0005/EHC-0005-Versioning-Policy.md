# EHC-0005 Versioning Policy

Artifact ID: EHC-0005
Decision Parent: GCD-0005
Status: CERTIFIED
Lifecycle State: Published
Authority: Genesis Governance Authority
Owner: Version Governance

## Purpose

Define version governance for enterprise health and capability contracts.

## Semantic Version Rules

Contract and capability versions SHALL follow semantic versioning:
- MAJOR: breaking change
- MINOR: backward-compatible feature addition
- PATCH: backward-compatible correction

## Backward Compatibility Window

1. Minimum backward compatibility window SHALL be one MAJOR line and two MINOR releases unless superseded by governance decision.
2. Deprecation notices SHALL be published before MAJOR-breaking activation.

## Breaking Change Approval Requirements

Breaking contract changes require:
- constitutional approval record
- migration guidance artifact
- compatibility impact statement
- rollout and rollback governance notes

## Version Governance Rules

1. contractVersion SHALL be present in every health payload.
2. capabilityVersion SHALL be present for each advertised capability.
3. applications SHALL not claim compatibility outside declared support window.
