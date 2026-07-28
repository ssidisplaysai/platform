# ADR-0005: Constitutional Dependency Direction

Status: Approved
Date: 2026-07-27
Decision Owners: Architecture Governance, Engineering Governance
Approval: Approved 2026-07-27 under GARR-0001A remediation authority

## 1. Decision Scope

Resolve the dependency-authority ambiguity recorded during Sprint 0.5 by defining an explicit constitutional dependency direction across Genesis architecture pillars and runtime planes.

## 2. Problem Statement

GARR-0001 finding FR-002 identified unresolved architectural ambiguity in dual-surface dependency descriptions and conceptual-loop language.

## 3. Decision

Authoritative dependency direction is declared as follows:

1. Governance and standards define constraints and do not depend on implementation artifacts.
2. Constitutional architecture artifacts may reference runtime and compiler specifications for traceability, but authority remains constitutional.
3. Definition plane artifacts provide validated metadata inputs to control plane runtime orchestration.
4. Control plane runtime consumes validated metadata and generated manifests and must not bypass definition validation.
5. Compiler semantic outputs and generation outputs may feed runtime boot artifacts through explicit manifest contracts only.

## 4. Prohibited Dependency Patterns

1. Definition plane code directly invoking runtime execution buses.
2. Runtime control plane constructing ad-hoc entity models that bypass validated definitions.
3. Parallel runtime orchestration authorities outside declared control and definition planes.
4. Undeclared cross-pillar dependencies that bypass architecture manifest registration.

## 5. Conformance Guidance

1. Dependency ambiguity language in architecture summaries must be replaced with this explicit direction model.
2. Existing historical reports remain preserved; superseding guidance is additive.
3. Future dependency changes require additive decision amendments and manifest registration.
