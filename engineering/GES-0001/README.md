# GES-0001 Canonical Evidence Model

This package implements the canonical evidence model for Genesis as a strict TypeScript value-object package.

## Contents

- `src/` contains the production model, validation, serialization, and schema generation code.
- `tests/` contains the Node test suite for creation, validation, serialization, and schema behavior.

## Model Surface

The canonical evidence record includes:

- Identity
- Source
- Metadata
- Content
- Structure
- Provenance
- Integrity
- Relationships
- Version

## Scripts

- `npm run build` compiles the package to `dist/`.
- `npm test` runs the package test suite with `tsx` and `node:test`.
- `npm run typecheck` runs a strict TypeScript check without emitting files.