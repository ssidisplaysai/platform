# Definition Registry

## Overview

The Definition Registry is the **first stage of the Genesis Business Compiler**.

It is the authoritative source of loaded Genesis business definitions for the planner, compiler, doctor, validator, documentation engine, and future AI tooling.

## Philosophy

**Definitions are compiled. Files are not.**

The Definition Registry serves as the boundary between the file system and the compilation pipeline. Files are not inherently definitions. The registry must explicitly load, validate, and register definitions. All downstream compilation operations obtain definitions through the registry.

## Components

### DefinitionRegistry

The public API for registering and retrieving definitions.

```javascript
import { registry } from "./DefinitionRegistry.mjs";

registry.register(definition);
registry.get("Customer");
registry.has("Customer");
registry.list();
registry.stats();
```

### DefinitionIndex

Internal data structure that maintains an in-memory index of definitions.

- Deterministic (sorted by name)
- Fast lookups by name
- Prevents duplicate registrations

### DefinitionResolver

Normalizes definition names to canonical form.

Handles variations:
- `Customer` → `Customer`
- `CustomerDefinition` → `Customer`
- `customer` → `Customer`

```javascript
import { resolveDefinitionName } from "./DefinitionResolver.mjs";

resolveDefinitionName("CustomerDefinition"); // Returns "Customer"
```

### DefinitionLoader

Loads definition candidates from configured root directories.

For Phase 1, returns lightweight definition records:

```javascript
import { loadDefinitionsFromRoots } from "./DefinitionLoader.mjs";

const candidates = loadDefinitionsFromRoots([
  "src/domain/definitions",
  "genesis/language",
]);
```

Each candidate record includes:
- `name` — Definition name
- `type` — "definition-candidate"
- `sourcePath` — File path
- `metadata.extension` — File extension

## Guarantee

The Definition Registry guarantees:

- **Determinism** — Same input always produces same state
- **Authoritatively** — One source of truth for loaded definitions
- **Isolation** — Compiler does not scan arbitrary files directly
- **Extensibility** — New loaders can be added in future phases

## Phases

**Phase 1 (Current):**
- Definition Registry API
- In-memory indexing
- Deterministic loading from roots

**Phase 2 (Future):**
- Definition validation
- Blueprint creation from candidates
- Relationship resolution

**Phase 3+ (Future):**
- Live registry watching
- Definition evolution
- Compatibility checking

## How It Works

```
File System
    ↓
DefinitionLoader (scans roots, finds candidates)
    ↓
Definition Candidates (name, sourcePath, extension)
    ↓
Future Blueprint Resolver (validates & parses)
    ↓
DefinitionRegistry (stores canonical definitions)
    ↓
Planner / Compiler / Tools (retrieve definitions)
```

## Key Rule

**The compiler must not scan arbitrary files directly.**

All file discovery and definition loading must go through the Definition Registry pipeline. This ensures:

- Consistent behavior
- Auditability of what gets loaded
- Ability to test without file system
- Clear separation between file discovery and compilation

## Not Implemented in Phase 1

- Definition parsing
- Definition validation
- Relationship resolution
- Live registry watching
- Artifact generation
- Runtime integration

These come in subsequent phases.
