# Blueprint Engine (GEDL)

## Purpose

The Blueprint Engine transforms Genesis Entity Definition Language (GEDL) YAML definitions into immutable Blueprint objects.

Blueprints are the canonical representation of business entities, consumed by the Planner and Compiler.

## Pipeline

```
GEDL YAML
    ↓
BlueprintLoader (parse YAML)
    ↓
BlueprintValidator (validate schema)
    ↓
BlueprintBuilder (create Blueprint)
    ↓
Blueprint object
    ↓
Planner/Compiler
```

## GEDL Structure

### Basic Entity

```yaml
entity: Customer
displayName: Customer
pluralName: Customers
description: Represents a customer in the business domain

fields:
  id:
    type: identifier
    description: Unique identifier
    required: true
    generated: true
  
  name:
    type: string
    description: Customer name
    required: true
    maxLength: 255

relationships:
  contacts:
    type: hasMany
    target: Contact
    description: Customer contacts

capabilities:
  search:
    enabled: true
    fields:
      - name
  audit:
    enabled: true

lifecycle:
  archived: true
  softDelete: true

metadata:
  namespace: crm
  icon: person
  searchable: true
```

## Field Types

- `string` - Text field
- `number` - Numeric field
- `boolean` - True/false field
- `identifier` - Unique identifier
- `email` - Email address
- `timestamp` - Date and time
- `date` - Date only
- `enum` - Enumerated values
- `text` - Long text
- `decimal` - Decimal number
- `json` - JSON data

## Relationship Types

- `hasOne` - One-to-one relationship
- `hasMany` - One-to-many relationship
- `belongsTo` - Reverse one-to-many
- `belongsToMany` - Many-to-many relationship

## Capabilities

- `search` - Enable search capability
- `audit` - Enable audit trail
- `validation` - Enable validation
- `permissions` - Enable access control
- `versioning` - Enable versioning

## Components

### Blueprint

Immutable blueprint object with entity metadata.

```javascript
blueprint.entity              // "Customer"
blueprint.displayName         // "Customer"
blueprint.pluralName          // "Customers"
blueprint.description         // Description text
blueprint.fields              // Field definitions
blueprint.relationships       // Relationship definitions
blueprint.capabilities        // Enabled capabilities
blueprint.lifecycle           // Lifecycle config
blueprint.metadata            // Metadata
```

### BlueprintValidator

Validates GEDL definitions against schema.

```javascript
import { validateGEDLDefinition } from "BlueprintValidator.mjs";

const result = validateGEDLDefinition(yamlObject);
// { isValid: true, errors: [] }
```

### BlueprintLoader

Loads YAML files from filesystem.

```javascript
import { loadEntityDefinition } from "BlueprintLoader.mjs";

const definition = loadEntityDefinition("Customer", "./definitions/entity");
```

### BlueprintBuilder

Orchestrates loading, validation, and blueprint creation.

```javascript
import { buildBlueprint } from "BlueprintBuilder.mjs";

const blueprint = await buildBlueprint("Customer", "./definitions/entity");
```

## Usage

### Load and Build Blueprint

```javascript
import { buildBlueprint } from "./tools/genesis/compiler/blueprints/BlueprintBuilder.mjs";

const blueprint = await buildBlueprint("Customer", "./definitions/entity");

console.log(blueprint.entity);           // "Customer"
console.log(blueprint.getFieldCount()); // 6
console.log(blueprint.getRelationshipCount()); // 3
console.log(blueprint.getEnabledCapabilities()); // ["search", "audit", "validation", "permissions"]
```

### Build Multiple Blueprints

```javascript
import { buildBlueprints } from "./tools/genesis/compiler/blueprints/BlueprintBuilder.mjs";

const blueprints = await buildBlueprints(
  ["Customer", "Project", "Quote"],
  "./definitions/entity"
);

// blueprints.Customer, blueprints.Project, blueprints.Quote
```

### Cache Blueprints

```javascript
import { createBlueprintCache } from "./tools/genesis/compiler/blueprints/BlueprintBuilder.mjs";

const cache = createBlueprintCache();
cache.add("Customer", blueprint);

const cached = cache.get("Customer");
```

## Definition Files

Entity definitions are stored as `*.entity.yaml` files:

```
definitions/
├── entity/
│   ├── Customer.entity.yaml
│   ├── Project.entity.yaml
│   ├── Quote.entity.yaml
│   ├── Contact.entity.yaml
│   └── Organization.entity.yaml
```

## Architecture

**Phase 8: GEDL Foundation**
- ✓ YAML-based entity definitions
- ✓ BlueprintValidator validates schema
- ✓ BlueprintLoader loads YAML
- ✓ BlueprintBuilder creates Blueprints
- ✓ Blueprint objects immutable and frozen

**Future Phases**
- Phase 9: Update Definition Registry to load blueprints
- Phase 10: Update Planner to consume blueprints
- Phase 11: Update Compiler to consume blueprints

## Constraints

- ✗ No code generation (yet)
- ✗ No runtime integration
- ✗ No application deployment
- ✗ No React or UI generation

## Key Principles

- **Technology-Neutral** — YAML definitions are independent of implementation
- **Immutable** — Blueprints are frozen and unchangeable
- **Deterministic** — Same YAML produces same Blueprint every time
- **Validated** — All definitions validated before blueprint creation
- **Discoverable** — Blueprints provide structured metadata

## Files

- `Blueprint.mjs` - Immutable blueprint object
- `BlueprintValidator.mjs` - GEDL schema validation
- `BlueprintLoader.mjs` - YAML file loading
- `BlueprintBuilder.mjs` - Blueprint orchestration
- `README.md` - This file
