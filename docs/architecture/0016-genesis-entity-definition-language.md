# ADR-0016: Genesis Entity Definition Language (GEDL)

## Status

ACCEPTED

## Date

2026-07-06

## Context

The Genesis Business Compiler has successfully implemented code-first entity generation through Phase 7. However, the current approach requires entities to be defined in TypeScript/JavaScript first, which is:

1. Technology-specific
2. Requires coding knowledge
3. Couples business logic to implementation
4. Makes it difficult to consume from business tools
5. Doesn't provide a clean audit trail of business decisions

The vision of Genesis OS is "Model the business once. Compile everything else from it."

To achieve this vision, we need a technology-neutral, business-friendly language for defining entities.

## Decision

We implement Genesis Entity Definition Language (GEDL):

### GEDL Characteristics

**1. YAML-Based**
- Human-readable
- Business analyst friendly
- Version control friendly
- Standard serialization format

**2. Entity-Centric**
```yaml
entity: Customer
displayName: Customer
pluralName: Customers
description: Represents a customer...
```

**3. Field Definitions**
```yaml
fields:
  id:
    type: identifier
  name:
    type: string
    required: true
  email:
    type: email
    unique: true
  status:
    type: enum
    values: [PROSPECT, ACTIVE, INACTIVE]
```

**4. Relationships**
```yaml
relationships:
  contacts:
    type: hasMany
    target: Contact
  organization:
    type: belongsTo
    target: Organization
```

**5. Capabilities**
```yaml
capabilities:
  search:
    enabled: true
  audit:
    enabled: true
  permissions:
    enabled: true
```

**6. Lifecycle**
```yaml
lifecycle:
  archived: true
  softDelete: true
  versioning: true
```

**7. Metadata**
```yaml
metadata:
  namespace: crm
  icon: person
  searchable: true
```

### Field Types

Standard types for business entities:
- `string`, `number`, `boolean`
- `identifier`, `email`
- `timestamp`, `date`
- `enum`, `text`, `decimal`, `json`

### Relationship Types

Standard relationships:
- `hasOne` — One-to-one
- `hasMany` — One-to-many
- `belongsTo` — Reverse relationship
- `belongsToMany` — Many-to-many

### Capabilities

Declarative capabilities:
- `search` — Make entity searchable
- `audit` — Track changes
- `validation` — Enable validation
- `permissions` — Access control
- `versioning` — Version history

## Architecture: GEDL to Runtime

```
Business Model
    ↓ (analyst creates)
GEDL YAML
    ↓ (BlueprintLoader)
Parsed Definition
    ↓ (BlueprintValidator)
Validated Definition
    ↓ (BlueprintBuilder)
Blueprint Object
    ↓ (Planner)
Generation Plan
    ↓ (Compiler)
Code Artifacts
    ↓ (Templates)
TypeScript Code
    ↓ (Promotion)
Runtime
    ↓ (Application)
Live System
```

## Blueprint Engine Components

### BlueprintLoader
- Loads `*.entity.yaml` files
- Parses YAML into JavaScript objects
- Handles file I/O and errors

### BlueprintValidator
- Validates GEDL schema
- Checks field types
- Validates relationships
- Enforces naming conventions
- Returns validation errors

### BlueprintBuilder
- Orchestrates loading and validation
- Creates immutable Blueprint objects
- Manages blueprint caching
- Supports batch blueprint building

### Blueprint Object
- Immutable (frozen)
- Provides structured metadata
- Consumed by Planner/Compiler
- Contains all entity information

## Integration Points

### Phase 8: GEDL Foundation (Current)
- ✓ Define YAML schema
- ✓ Implement BlueprintLoader
- ✓ Implement BlueprintValidator
- ✓ Implement BlueprintBuilder
- ✓ Create example Customer.entity.yaml

### Phase 9: Definition Registry Integration
- Update Definition Registry to discover `*.entity.yaml` files
- Load and build blueprints automatically
- Index blueprints for O(1) lookup

### Phase 10: Planner Integration
- Planner consumes Blueprint objects
- Builds plans from blueprint metadata
- Automatically determines artifact types from fields

### Phase 11: Compiler Integration
- Compiler consumes Blueprints
- Generates code from blueprint structure
- Uses field types to determine implementation

## Example: Customer Entity

```yaml
entity: Customer
displayName: Customer
pluralName: Customers
description: Represents a customer in the business domain

fields:
  id:
    type: identifier
    required: true
    generated: true
  name:
    type: string
    required: true
    maxLength: 255
  email:
    type: email
    required: true
    unique: true
  status:
    type: enum
    values: [PROSPECT, ACTIVE, INACTIVE, CHURNED]
    default: PROSPECT
  createdAt:
    type: timestamp
    generated: true

relationships:
  contacts:
    type: hasMany
    target: Contact
  organization:
    type: belongsTo
    target: Organization

capabilities:
  search:
    enabled: true
    fields: [name, email]
  audit:
    enabled: true
  permissions:
    enabled: true
    roles: [admin, editor, viewer]

lifecycle:
  archived: true
  softDelete: true

metadata:
  namespace: crm
  icon: person
  searchable: true
  tags: [entity, core, crm]
```

## Consequences

### Positive

- ✓ Business and tech can collaborate on definitions
- ✓ Definitions are version-controllable
- ✓ Schema is discoverable and validatable
- ✓ Enables automated code generation
- ✓ Separates business model from implementation
- ✓ Enables cross-platform code generation
- ✓ Supports audit trails for model changes
- ✓ Foundation for future tooling

### Negative

- ✗ Requires learning GEDL syntax (though very simple)
- ✗ Initial setup of entity definitions
- ✗ Parser implementation required

### Mitigation

- Provide comprehensive documentation
- Include many examples
- Create CLI tools for blueprint inspection
- Support auto-discovery of entities

## Rationale

GEDL provides the missing link between business vision ("Model once, compile everything") and implementation. By making entity definitions explicit, discoverable, and version-controlled, we enable:

1. **Business/Tech Collaboration** — Business analysts define entities, developers implement
2. **Code Generation** — Automated code generation from definitions
3. **Audit Trail** — Complete history of model changes
4. **Multiple Implementations** — Same definition → different platforms
5. **Tooling** — Potential for visual entity modelers
6. **Documentation** — Definitions are self-documenting

## References

- [ADR-0001: Genesis OS Architecture](0001-genesis-architecture.md)
- [ADR-0004: Domain Model Design](0004-domain-model.md)
- [ADR-0005: Metadata Engine Design](0005-metadata-engine.md)

## Related Documents

- [tools/genesis/compiler/blueprints/README.md](../tools/genesis/compiler/blueprints/README.md)
- [definitions/entity/Customer.entity.yaml](../definitions/entity/Customer.entity.yaml)

---

**Architecture Decision Record Created:** 2026-07-06
**Phase:** Genesis OS v0.5 - Genesis Entity Definition Language
**Status:** ACCEPTED ✓
