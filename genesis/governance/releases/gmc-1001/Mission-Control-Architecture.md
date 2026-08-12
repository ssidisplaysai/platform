# Mission Control Architecture

Work Order: GMC-1001
Date: 2026-07-30

## Core Services

- src/platform/gmc/mission-control-service.ts
- src/platform/gmc/application-discovery-service.ts
- src/platform/gmc/application-launcher.ts
- src/platform/gmc/navigation-service.ts
- src/platform/gmc/health-summary-service.ts
- src/platform/gmc/capability-summary-service.ts
- src/platform/gmc/workspace-assembler.ts
- src/platform/gmc/launch-policy-resolver.ts
- src/platform/gmc/runtime.ts

## Service Dependencies

EAR (certified)
-> Application discovery and launch metadata

EHC (certified)
-> health, readiness, liveness, capability, compatibility summaries

Mission Control
-> orchestrates data assembly only

## Architecture Boundaries

- no registry ownership
- no health computation ownership
- no identity/auth ownership
- no application runtime ownership

## Runtime Composition

GMC runtime composes MissionControlService from independent subservices and certified platform dependencies.
