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

## Constitutional Decision Register

| Decision ID | Title | State | Reference |
|---|---|---|---|
| GCD-0003 | Genesis Operational Platform Established | APPROVED | genesis/engineering/packages/GCD-0003/Genesis-Operational-Platform-Established-Decision.md |
