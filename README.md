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

Genesis is in stabilization mode under sprint GSS-0001, focused on engineering baseline readiness, governance completion, documentation integrity, and implementation discipline.

See [docs/reports/GSS-0001_COMPLETION_REPORT.md](docs/reports/GSS-0001_COMPLETION_REPORT.md) for deliverable status.
