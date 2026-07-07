# Generated Slice Validator

## Purpose

Validates sandbox-generated entity slices under `generated/genesis/{Entity}/`.

The validator ensures that all 9 expected artifact files exist for a generated entity:

1. `{Entity}Definition.ts` — Entity schema definition
2. `{Entity}Repository.ts` — Data access layer
3. `{Entity}Service.ts` — Business logic layer
4. `{Entity}Validator.ts` — Validation logic
5. `{Entity}Events.ts` — Domain events
6. `{Entity}Permissions.ts` — Access control
7. `{Entity}Search.ts` — Search and filtering
8. `{Entity}Documentation.md` — API documentation
9. `{Entity}Tests.ts` — Unit tests

## Usage

### Validate a single entity

```bash
node tools/genesis/genesis.mjs validate generated Customer
```

### Output (Success)

```
Genesis Generated Slice Validator v0.1

Validating Generated Slice

Customer

✓ Definition
✓ Repository
✓ Service
✓ Validator
✓ Events
✓ Permissions
✓ Search
✓ Documentation
✓ Tests

Validation Complete

9 Checks Passed
0 Issues Found
```

### Output (Missing Files)

```
Genesis Generated Slice Validator v0.1

Validating Generated Slice

Customer

✓ Definition
✓ Repository
✖ Missing: CustomerService.ts

Validation Complete

9 Checks Passed
1 Issues Found
```

## Exit Codes

- **0** — All checks passed (slice is healthy)
- **1** — One or more checks failed (slice has issues)

## Implementation

### Files

- `GeneratedSliceValidator.mjs` — Core validation logic
- `GeneratedSliceReport.mjs` — Immutable validation reports

### Key Features

✓ **Artifact Checking** — Verifies all 9 files exist
✓ **No Mutations** — Read-only validation, never modifies files
✓ **No Runtime Integration** — Standalone validator
✓ **No CRM** — Entity-agnostic validation
✓ **No Production Changes** — Only validates generated/ directory
✓ **Immutable Reports** — Reports frozen after creation
✓ **Clear Output** — User-friendly success/failure formatting

## Constraints

- Does not move files into `src/core`
- Does not integrate into runtime or metadata engine
- No CRM implementation
- No production entity integration
- Only validates files under `generated/genesis/`

## Module Exports

### GeneratedSliceValidator.mjs

```javascript
export async function validateGeneratedSlice(entityName, options = {})
export async function validateGeneratedSlices(entityNames, options = {})
```

### GeneratedSliceReport.mjs

```javascript
export class GeneratedSliceReport
export function createGeneratedSliceReport(config)
```
