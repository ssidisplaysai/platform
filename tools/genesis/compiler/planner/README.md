# Generation Planner

## Overview

The Generation Planner is the first stage of **Phase 2 of the Genesis Business Compiler**.

It converts business definitions into **immutable, deterministic Generation Plans** that describe what artifacts need to be created.

## Philosophy

**The planner creates plans. The compiler executes plans.**

Planning and execution must remain separate. This ensures that:

- Generation decisions are auditable
- Plans can be inspected before execution
- The same definition always produces the same plan
- Plans are immutable and reproducible

## Components

### GenerationStep

Represents one planned artifact or action.

```javascript
const step = createGenerationStep({
  id: "entity-definition",
  type: "entity-definition",
  name: "Customer Definition",
  description: "Entity definition for Customer",
  targetPath: "src/domain/definitions/Customer.definition.ts",
  metadata: { entityName: "Customer" },
});
```

Each step has:
- `id` — Unique stable identifier
- `type` — Artifact type (entity-definition, repository, service, etc.)
- `name` — Human-readable name
- `description` — What this step creates
- `targetPath` — Where artifact would be written
- `dependencies` — Array of step IDs this depends on
- `metadata` — Additional context

**Steps are immutable.**

### GenerationPlan

An immutable ordered plan describing all artifacts for an entity.

```javascript
const plan = planEntity(context);
```

A plan contains:
- `id` — Unique plan identifier
- `name` — Human-readable plan name
- `subject` — What is being planned (e.g., "Customer")
- `subjectType` — Type of subject (e.g., "entity")
- `steps` — Array of GenerationStep objects (ordered, immutable)
- `metadata` — Context including entityName, rootDir
- `createdAt` — ISO timestamp

**Plans are fully immutable.**

### GenerationContext

Holds context for planning operations.

```javascript
const context = createGenerationContext({
  rootDir: process.cwd(),
  definition: { name: "Customer", type: "entity" },
});
```

Context includes:
- `rootDir` — Where artifacts would be written
- `definition` — Definition being planned
- `blueprint` — Optional parsed blueprint (future use)
- `options` — Planner options

### GenerationPlanner

The main planning algorithm.

```javascript
import { planEntity } from "./GenerationPlanner.mjs";

const plan = planEntity(context);
```

Currently supports:
- `planEntity(context)` — Plan entity generation

For an entity, the planner creates **9 ordered steps**:

1. Definition
2. Repository
3. Service
4. Validator
5. Events
6. Permissions
7. Search
8. Documentation
9. Tests

Each step knows its dependencies, so the Compiler can execute them in the correct order.

## Guarantee: Determinism

**Same definition → Same plan (always)**

The planner is deterministic:
- Plans have stable step IDs
- Steps are ordered consistently
- No randomness or timing dependencies
- Plans can be compared for equality

This allows:
- Reproducible builds
- Git-friendly diffs
- Cache validation
- Plan comparison and testing

## What the Planner Does NOT Do

- Does not read files (uses Definition Registry)
- Does not create artifacts
- Does not execute templates
- Does not modify the file system
- Does not depend on external tools
- Does not parse blueprint details (Phase 2 only)

These are responsibilities of later compiler phases.

## How It Works

```
GenerationContext (definition + rootDir)
        ↓
   planEntity()
        ↓
  Identify steps (definition → 9 artifacts)
        ↓
  Create GenerationStep objects
        ↓
  Create GenerationPlan (immutable)
        ↓
  Return to caller (Compiler in Phase 3)
```

## Phase 2 Scope

Currently, the planner:
- Works with simple entity definitions
- Produces a fixed 9-step plan
- Uses stable step IDs
- Validates input
- Returns immutable results

Future phases will:
- Support other artifact types
- Handle complex relationships
- Optimize step ordering
- Support custom step templates
- Validate against blueprint

## Testing

Plans can be tested deterministically:

```javascript
const plan1 = planEntity(context);
const plan2 = planEntity(context);

// Same plan?
assert(plan1.id !== plan2.id); // Different IDs (timestamps)
assert(plan1.steps.length === plan2.steps.length); // Same steps
assert(plan1.subject === plan2.subject); // Same subject
```

## CLI Usage

```bash
node tools/genesis/genesis.mjs plan Customer
```

This:
1. Accepts "Customer" as the entity name
2. Creates a lightweight definition
3. Creates a generation context
4. Calls planEntity()
5. Prints the plan clearly

Output:

```
Genesis Planner v0.1

Planning Entity

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

Plan Complete

9 Artifacts
```

## Key Files

- **GenerationStep.mjs** — Individual artifact in the plan
- **GenerationPlan.mjs** — Complete immutable plan
- **GenerationContext.mjs** — Planning context
- **GenerationPlanner.mjs** — Planning algorithm
- **README.md** — This file
