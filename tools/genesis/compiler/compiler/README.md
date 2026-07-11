# Generation Compiler

## Overview

The Generation Compiler is the infrastructure for **Phase 3 of the Genesis Business Compiler**.

It executes a Generation Plan and produces a Compilation Result.

## Philosophy

**The compiler executes plans. It does not make planning decisions.**

The compiler:

- Accepts a Generation Plan (from Phase 2)
- Executes the plan deterministically
- Respects step ordering and dependencies
- Produces a Compilation Result
- Reports what was done

## Components

### CompilationDiagnostic

Represents a diagnostic message during compilation.

```javascript
const diagnostic = createCompilationDiagnostic({
  level: "info", // "info", "warning", "error"
  code: "COMPILE_START",
  message: "Starting compilation for Customer",
  stepId: "entity-definition",
  metadata: { entityName: "Customer" },
});
```

Diagnostics have:
- `level` — Severity (info, warning, error)
- `code` — Diagnostic code for categorization
- `message` — Human-readable message
- `stepId` — Associated step (optional)
- `metadata` — Additional context

### CompilationContext

Holds context for compilation operations.

```javascript
const context = createCompilationContext({
  rootDir: process.cwd(),
  plan: generationPlan,
  mode: "dry-run", // "dry-run" or "write" (Phase 3 only supports dry-run)
  options: { /* future options */ },
});
```

Context includes:
- `rootDir` — Where artifacts would be written
- `plan` — Generation Plan to execute
- `mode` — Execution mode (dry-run default)
- `options` — Compiler options

### CompilationResult

The result of compilation.

```javascript
const result = compilePlan(context);

console.log(result.success);        // true
console.log(result.mode);           // "dry-run"
console.log(result.artifacts.length); // 9
console.log(result.diagnostics.length); // 11+
```

Result is immutable and contains:
- `success` — Whether compilation succeeded
- `mode` — Mode used
- `planId` — Associated plan ID
- `artifacts` — Array of artifact records
- `diagnostics` — Array of diagnostic messages
- `completedAt` — ISO timestamp

### GenerationCompiler

The main compilation algorithm.

```javascript
import { compilePlan } from "./GenerationCompiler.mjs";

const result = compilePlan(context);
```

Currently supports:
- `compilePlan(context)` — Compile a generation plan

For each step in the plan:
1. Create an artifact record
2. Add a diagnostic message
3. Respect step ordering

In Phase 3 (dry-run mode):
- **Does NOT write files**
- Does NOT execute templates
- Does NOT modify the file system
- Creates artifact records only

## Execution Modes

### dry-run

Planned but not executed.

- No file system changes
- Artifacts records created
- Used for planning and validation
- **Currently the only supported mode**

### write

Would execute compilation (Phase 4+).

- Files would be written
- Templates would be rendered
- Artifacts would be created
- Not yet implemented

## Artifact Record

Each artifact record contains:

```javascript
{
  stepId: "entity-definition",
  type: "entity-definition",
  name: "Customer Definition",
  targetPath: "src/domain/definitions/Customer.definition.ts",
  status: "planned", // Phase 3: always "planned"
  metadata: { entityName: "Customer" },
}
```

Status values (planned for future phases):
- `planned` — Step is planned (Phase 3)
- `rendered` — Template rendered (Phase 4)
- `written` — File written (Phase 4)
- `failed` — Compilation failed

## Compilation Pipeline

```
Generation Plan (from Phase 2)
        ↓
CompilationContext (rootDir, plan, mode)
        ↓
compilePlan()
        ↓
  For each step:
    - Create artifact record
    - Add diagnostic
        ↓
CompilationResult (immutable, frozen)
```

## Phase 3 Scope

Currently, the compiler:
- Accepts plans and contexts
- Iterates steps in order
- Creates artifact records
- Produces diagnostics
- Returns immutable result
- Supports dry-run mode only

Future phases will:
- Support write mode
- Load and execute templates
- Render artifacts with metadata
- Write files to disk
- Handle errors and conflicts
- Support incremental compilation

## CLI Usage

```bash
node tools/genesis/genesis.mjs compile Customer
```

This:
1. Accepts "Customer" as entity name
2. Creates a definition
3. Creates a generation context
4. Plans the entity (Phase 2)
5. Compiles the plan (Phase 3, dry-run)
6. Prints results

Output:

```
Genesis Compiler v0.1

Compiling Entity

Customer

Mode
dry-run

✓ Definition planned
✓ Repository planned
✓ Service planned
✓ Validator planned
✓ Events planned
✓ Permissions planned
✓ Search planned
✓ Documentation planned
✓ Tests planned

Compilation Complete

9 Artifacts Planned

No files written.
```

## Key Files

- **CompilationDiagnostic.mjs** — Diagnostic messages
- **CompilationContext.mjs** — Compilation context
- **CompilationResult.mjs** — Compilation result
- **GenerationCompiler.mjs** — Compilation algorithm
- **README.md** — This file

## Guarantees

- **Immutability** — Result is frozen
- **Determinism** — Same plan → Same result
- **Safety** — Phase 3 dry-run never modifies files
- **Diagnostics** — All operations are reported
- **Auditability** — Complete trace in diagnostics
