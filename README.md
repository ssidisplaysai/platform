# Genesis OS

Genesis OS is a metadata-driven enterprise operating system and compiler platform.

Core principle:

Model the business once. Compile everything else from it.

## Repository Purpose

This repository contains:

1. Architecture records and governance artifacts.
2. Genesis compiler platform tooling.
3. Runtime and module scaffolding.
4. Engineering standards, proof packs, and sprint deliverables.

## Start Here

1. Repository overview: [REPOSITORY_OVERVIEW.md](REPOSITORY_OVERVIEW.md)
2. Repository vision: [REPOSITORY_VISION.md](REPOSITORY_VISION.md)
3. Engineering handbook: [GENESIS_ENGINEERING_HANDBOOK.md](GENESIS_ENGINEERING_HANDBOOK.md)
4. Contribution process: [CONTRIBUTING.md](CONTRIBUTING.md)
5. Security policy: [SECURITY.md](SECURITY.md)

## Key Paths

1. Architecture records: [docs/architecture](docs/architecture)
2. Compiler platform: [tools/genesis](tools/genesis)
3. Source tree: [src](src)
4. Definitions: [definitions/entity](definitions/entity)
5. Genesis standards: [genesis](genesis)

## Local Commands

Install dependencies:

```bash
npm install
```

Run app shell:

```bash
npm run dev
```

Run lint:

```bash
npm run lint
```

Run Genesis test framework:

```bash
node tools/genesis/genesis.mjs test
```

## Program Status

Genesis has declared the Genesis Business Genome Foundation under GBGF-0001 with a conditional release gate. GBG-0002 remains frozen under GBG-0002A, GBG-0003 remains implemented and unfrozen, GBG-0003A remains historical NOT CERTIFIED, GBG-0003C remains historical CERTIFICATION EXECUTED - NOT CERTIFIED, GBG-0003D remains historical REMEDIATED, GBG-0003E remains historical NOT CERTIFIED with missingCausationCount=93 preserved, GBG-0003F remains historical REMEDIATED, GBG-0003G remains immutable NOT CERTIFIED with freeze/release denied and no tag creation, GBG-0003H remains REMEDIATED WITH NON-BLOCKING CONDITIONS, and GBGF-0001 records Foundation declaration with freeze/release/GBG-0004 authorization denied pending GBG-0003I CERTIFIED disposition.
Genesis has also declared GCDM-0001 as the Genesis Canonical Data Model constitutional architecture package, establishing the fifth pillar semantic model baseline for canonical entities, identity, relationships, evidence, lifecycle, versioning, validation, and governance through architecture-only artifacts.
Genesis has completed GBGF-0001A as the constitutional architecture completion program for the Business Genome Foundation, documenting full boundary, dependency, interface, lifecycle, governance, extension, integration, consistency, and traceability closure without certification, freeze, or release actions.
Genesis has completed GCDM-0001A as the constitutional completion program for the Canonical Data Model, documenting full entity, universal object contract, identity, relationship, evidence, validation, versioning, governance, extension, serialization, API, platform alignment, semantic consistency, and traceability closure without certification, freeze, or release actions.
Genesis has completed GARR-0001 as an internal constitutional architecture readiness review package and issued a pre-audit disposition of ARCHITECTURE NOT READY with bounded remediation sequencing required before GEA-0002 enterprise constitutional audit preparation.
Genesis has completed GARR-0001A as the bounded constitutional remediation package for GARR-0001 MAJOR findings FR-001 through FR-004 with additive-only authority, historical preservation, and revalidation handoff readiness.
Genesis has completed GARR-0001B as an independent constitutional readiness revalidation package and issued ARCHITECTURE READY for transition-gate authorization to begin GEA-0002 preparation.

See [docs/reports/GSS-0001_COMPLETION_REPORT.md](docs/reports/GSS-0001_COMPLETION_REPORT.md) for deliverable status.
