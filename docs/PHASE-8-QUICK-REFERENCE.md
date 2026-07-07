# Phase 8 Quick Reference

## GEDL File Structure

Location: `definitions/entity/` directory

**Naming Convention:** `{entity}.entity.yaml` (lowercase, singular)

Example: `definitions/entity/customer.entity.yaml`

## Blueprint API Reference

### Loading a Blueprint

```javascript
import { buildBlueprint } from './tools/genesis/compiler/blueprints/BlueprintBuilder.mjs';

const blueprint = await buildBlueprint('Customer', './definitions/entity');
```

### Blueprint Methods

| Method | Returns | Example |
|--------|---------|---------|
| `getFields()` | Object | `blueprint.getFields()` → fields object |
| `getFieldCount()` | Number | `blueprint.getFieldCount()` → 6 |
| `getField(name)` | Object | `blueprint.getField('id')` → field object |
| `getRequiredFields()` | Array | `blueprint.getRequiredFields()` → [id, name, email] |
| `getRelationships()` | Object | `blueprint.getRelationships()` → relationships object |
| `getRelationshipCount()` | Number | `blueprint.getRelationshipCount()` → 3 |
| `hasCapability(name)` | Boolean | `blueprint.hasCapability('search')` → true |
| `getEnabledCapabilities()` | Array | `blueprint.getEnabledCapabilities()` → [search, audit, validation, permissions] |
| `formatForConsole()` | String | `console.log(blueprint.formatForConsole())` |
| `toJSON()` | Object | `JSON.stringify(blueprint.toJSON())` |

## GEDL Field Types

| Type | Description | Example |
|------|-------------|---------|
| `identifier` | Auto-generated unique ID | User ID |
| `string` | Text with optional maxLength | Name, Title |
| `email` | Email validation | Email address |
| `enum` | Enumerated values | Status (ACTIVE, INACTIVE) |
| `timestamp` | Date/time | createdAt, updatedAt |
| `number` | Integer or decimal | Amount, Count |
| `boolean` | True/false | isActive, isVerified |
| `json` | Structured data | Metadata, Settings |
| `reference` | Foreign key | User ID reference |

## GEDL Relationship Types

| Type | Meaning |
|------|---------|
| `hasMany` | One entity has many related entities |
| `belongsTo` | Entity belongs to one parent entity |
| `hasOne` | Entity has one related entity |
| `manyToMany` | Multiple relationships between two entities |

## Capabilities

| Capability | Purpose |
|------------|---------|
| `search` | Full-text search and indexing |
| `audit` | Change tracking and history |
| `validation` | Business rule validation |
| `permissions` | Role-based access control |

## File Structure Summary

### Core GEDL Files
- `definitions/entity/customer.entity.yaml` - Example entity definition

### Blueprint Engine System
- `tools/genesis/compiler/blueprints/Blueprint.mjs` - Blueprint class
- `tools/genesis/compiler/blueprints/BlueprintValidator.mjs` - Schema validator
- `tools/genesis/compiler/blueprints/BlueprintLoader.mjs` - YAML loader
- `tools/genesis/compiler/blueprints/BlueprintBuilder.mjs` - Orchestrator
- `tools/genesis/compiler/blueprints/README.md` - System documentation

### Documentation
- `docs/architecture/0016-genesis-entity-definition-language.md` - GEDL ADR
- `docs/architecture/0017-phase-8-completion-report.md` - Completion report

## Usage Example

### Create a New Entity Definition

1. Create file: `definitions/entity/myentity.entity.yaml`
2. Define entity structure with fields, relationships, capabilities
3. Load with `buildBlueprint('MyEntity', './definitions/entity')`

### Sample Entity Definition

```yaml
entity: Product
displayName: Product
pluralName: Products
description: Represents a product in inventory

fields:
  id:
    type: identifier
    required: true
    generated: true
    description: Unique product identifier
  name:
    type: string
    required: true
    maxLength: 255
    description: Product name
  price:
    type: number
    required: true
    description: Product price in USD
  sku:
    type: string
    required: true
    unique: true
    description: Product SKU
  status:
    type: enum
    description: Product status
    default: ACTIVE
  createdAt:
    type: timestamp
    generated: true
  updatedAt:
    type: timestamp
    generated: true
    autoUpdate: true

relationships:
  category:
    type: belongsTo
    target: Category
    description: Product category
  variants:
    type: hasMany
    target: ProductVariant
    description: Product variants

capabilities:
  search:
    enabled: true
    fields: []
  audit:
    enabled: true
    trackChanges: true
  validation:
    enabled: true
  permissions:
    enabled: true
    roles: []

lifecycle:
  draft: false
  archived: true
  softDelete: true
  versioning: true

metadata:
  namespace: inventory
  icon: box
  color: orange
  searchable: true
  orderable: true
  tags: []
```

## Integration Points (Upcoming Phases)

### Phase 9: Definition Registry
- Blueprints will be discoverable via entity name
- Registry auto-scans `definitions/entity/` directory

### Phase 10: Planner
- Uses Blueprint to determine required artifacts
- Blueprint capabilities control artifact generation

### Phase 11: Compiler
- Reads Blueprint during code generation
- Uses metadata for technology selection

## Notes

- YAML parser supports subset of YAML suitable for GEDL
- No external dependencies required
- Blueprints are immutable (frozen objects)
- Supports up to 4-level nesting in YAML
- Cache with LRU eviction for performance
