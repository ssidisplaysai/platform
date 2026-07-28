# Architecture Decisions

This document records the architectural direction for Genesis OS and should be updated as significant design choices are made.

## Decision Principles

- Preserve Clean Architecture boundaries.
- Keep domain meaning central.
- Keep runtime orchestration explicit.
- Favor metadata-driven extensibility over hardcoded implementations.

## Current Direction

- Runtime orchestrates platform behavior.
- Services host business logic.
- Repositories handle persistence concerns.
- UI remains presentation-focused.

## Approved ADR Set

- ADR-0001 Compiler Architecture: Approved 2026-07-27.
- ADR-0002 Canonical Entity Model: Approved 2026-07-27.
- ADR-0003 Registry Evolution: Approved 2026-07-27.
- ADR-0004 Runtime Boundaries: Approved 2026-07-27.
- ADR-0005 Constitutional Dependency Direction: Approved 2026-07-27.

## Authority Notes

- ADR approvals above close the Sprint 0.5 proposed-state gap under the GARR-0001A remediation package.
- Dependency-direction authority is defined by ADR-0005 and applied additively to architectural dependency governance artifacts.
