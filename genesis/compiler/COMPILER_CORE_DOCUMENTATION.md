# Compiler Core Documentation

Document: GES-0001 Implementation Documentation
Scope: Genesis Compiler Core Implementation v1.0
Status: Completed

## Overview

The Compiler Core is implemented as the orchestration platform for Genesis compiler passes.
It executes pass pipelines deterministically, enforces contract-first boundaries, and produces auditable manifests and diagnostics.

The Compiler Core does not perform business semantics or runtime behavior generation.

## Implemented Subsystems

### 1. Compiler Session

Implemented in:
- src/compiler/core/CompilerSession.ts

Capabilities:
- lifecycle state transitions
- session identity
- metadata tracking
- restart and replay session creation
- termination semantics

### 2. Compiler Context

Implemented in:
- src/compiler/core/CompilerContext.ts

Capabilities:
- immutable configuration references
- shared references
- pass status tracking
- artifact and manifest reference tracking
- state snapshots

### 3. Compiler Pass Registry

Implemented in:
- src/compiler/core/CompilerPassRegistry.ts

Capabilities:
- pass registration
- pass discovery and lookup
- capability-based discovery
- lifecycle metadata updates (deprecate/replace)

### 4. Compiler Pipeline

Implemented in:
- src/compiler/core/CompilerPipeline.ts

Capabilities:
- deterministic topological pass scheduling
- dependency resolution
- pass execution boundaries
- failure isolation at pass boundary
- artifact/diagnostic/manifest integration

### 5. Compiler Artifact Manager

Implemented in:
- src/compiler/core/CompilerArtifactManager.ts

Capabilities:
- artifact registration
- deterministic artifact identity by checksum
- immutable artifact records
- artifact lookup/listing

### 6. Compiler Manifest Manager

Implemented in:
- src/compiler/core/CompilerManifestManager.ts

Capabilities:
- compiler session manifest construction
- pass and artifact manifest inclusion
- deterministic manifest checksum

### 7. Compiler Diagnostics Engine

Implemented in:
- src/compiler/core/CompilerDiagnosticsEngine.ts

Capabilities:
- error/warning/info reporting
- severity filtering
- architecture observation recording
- diagnostic aggregation

### 8. Compiler Validation Engine

Implemented in:
- src/compiler/core/CompilerValidationEngine.ts

Capabilities:
- pass contract validation
- artifact validation
- manifest validation

### 9. Compiler Version Manager

Implemented in:
- src/compiler/core/CompilerVersionManager.ts

Capabilities:
- compiler/pipeline/manifest version snapshot
- pass version registration
- deprecation and replacement metadata

## Integrated Passes

The following certified passes were integrated through orchestration wrappers without changing pass behavior:
- Discovery Compiler Pass wrapper: src/compiler/core/passes/DiscoveryCompilerPass.ts
- Evidence Compiler Pass wrapper: src/compiler/core/passes/EvidenceCompilerPass.ts

Core facade:
- src/compiler/core/CompilerCore.ts

Exports:
- src/compiler/core/index.ts
- src/compiler/index.ts

## Determinism and Compatibility Notes

- Pass ordering is deterministic under equivalent dependency declarations.
- Artifacts and manifests use stable hashing for reproducibility.
- Behavioral compatibility test confirms orchestrated Discovery+Evidence output matches direct certified flow.

## Architecture Observations

No blocking architecture deficiencies were identified during this implementation cycle.
No architectural changes were introduced.
