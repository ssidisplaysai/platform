# EnterpriseObjectBlueprint: Compiler Intermediate Representation

## Overview

**EnterpriseObjectBlueprint** is the canonical Intermediate Representation (IR) for the Genesis OS compiler pipeline. It represents the stable contract between the metadata expansion phase and all downstream consumers (renderers, validators, documentation generators, etc.).

## Architecture

### The Compilation Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    Entity YAML Definition                       │
│  (Customer.entity.yaml, Vendor.entity.yaml, etc.)               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Phase 1: Metadata Expansion                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • FieldExpander: Types, constraints, validation rules  │   │
│  │ • RelationshipExpander: Accessor methods, lazy loading  │   │
│  │ • CapabilityExpander: Feature flags normalization       │   │
│  │ • LifecycleExpander: State machines, transitions        │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         Phase 2: Blueprint Construction (IR Creation)          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ BlueprintBuilder:                                       │   │
│  │ • Consolidates all expanded metadata                    │   │
│  │ • Creates canonical EnterpriseObjectBlueprint           │   │
│  │ • Validates blueprint structure                         │   │
│  │ • Single IR for all downstream consumers               │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │  Repository  │ │ Documentation│ │   Service    │
    │   Renderer   │ │   Renderer   │ │   Renderer   │
    │ (reads IR)   │ │ (reads IR)   │ │ (reads IR)   │
    └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
           │                 │                 │
           └─────────────────┼─────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
       │ Repository   │ │Documentation │ │   Service    │
       │     Code     │ │   (Markdown) │ │     Code     │
       │ (.ts file)   │ │   (.md file) │ │  (.ts file)  │
       └──────────────┘ └──────────────┘ └──────────────┘
```

## EnterpriseObjectBlueprint Structure

The blueprint has **11 explicit typed sections**, each representing a domain of entity metadata:

### 1. **metadata** - Core Entity Information
```typescript
metadata: {
  entity: string;              // E.g., 'Customer', 'Vendor', 'Project'
  displayName: string;         // Human-readable name
  pluralName: string;          // Plural form
  description: string;         // Entity description
  namespace: string;           // Logical namespace (e.g., 'crm', 'inventory')
  tags: string[];              // Classification tags
  generatedAt: string;         // ISO timestamp
  definitionPath: string;      // Path to source YAML
}
```

### 2. **fields** - Field Definitions Section
```typescript
fields: {
  all: FieldDefinition[];      // All expanded field definitions
  required: FieldDefinition[]; // Required fields
  unique: FieldDefinition[];   // Unique fields
  generated: FieldDefinition[];// Auto-generated (id, timestamps)
  searchable: FieldDefinition[];// Fields in search index
}
```

Each `FieldDefinition`:
- Name, type, description
- Validation constraints (required, unique, max/min length, patterns)
- Generated/readonly flags
- Default values

### 3. **relationships** - Relationship Definitions Section
```typescript
relationships: {
  all: RelationshipDefinition[];     // All relationships
  hasMany: RelationshipDefinition[]; // One-to-many
  hasOne: RelationshipDefinition[];  // One-to-one
  belongsTo: RelationshipDefinition[];// Many-to-one
}
```

Each `RelationshipDefinition`:
- Name, type, target entity
- Cascade delete behavior, lazy loading
- Generated accessor method names

### 4. **lifecycle** - State Machine Section
```typescript
lifecycle: {
  states: { [stateName]: StateDefinition };
  transitions: TransitionDefinition[];
  softDelete: boolean;
  versioning: boolean;
  archived: boolean;
  timestamps: {
    createdAt: boolean;
    updatedAt: boolean;
    deletedAt: boolean;
    archivedAt: boolean;
  };
}
```

Defines entity lifecycle with states and valid transitions.

### 5. **capabilities** - Feature Capabilities Section
```typescript
capabilities: {
  search: { enabled: boolean; fields: string[] };
  audit: { enabled: boolean; trackChanges: boolean };
  validation: { enabled: boolean };
  permissions: { enabled: boolean; roles: string[] };
  events: { enabled: boolean };
}
```

All features normalized to `{enabled, ...config}` structure.

### 6. **validation** - Validation Rules Section
```typescript
validation: {
  rules: ValidationRule[];     // All rules
  required: ValidationRule[];  // Required field rules
  format: ValidationRule[];    // Format validation (email, etc.)
  unique: ValidationRule[];    // Unique constraint rules
  range: ValidationRule[];     // Min/max, length constraints
}
```

### 7. **permissions** - Permission Rules Section
```typescript
permissions: {
  rules: PermissionRule[];
  roles: string[];
  roleActions: { [role]: string[] };
}
```

### 8. **api** - API Specification Section
```typescript
api: {
  baseUrl: string;             // E.g., '/api/customer'
  camelCase: string;           // camelCase entity name
  endpoints: EndpointSpec[];   // CRUD endpoints
}
```

### 9. **repository** - Repository Layer Section
```typescript
repository: {
  methods: MethodSpec[];       // findById, findAll, search, etc.
  supportsSoftDelete: boolean;
  tableName: string;
}
```

### 10. **service** - Service Layer Section
```typescript
service: {
  methods: MethodSpec[];
  requiresValidation: boolean;
  requiresAudit: boolean;
}
```

### 11. **documentation** - Documentation Section
```typescript
documentation: {
  title: string;
  sections: DocumentationSection[];
}
```

## Blueprint as Stable IR

### Key Design Principles

1. **Single Source of Truth**: The blueprint is the only source of truth after metadata expansion
2. **Stable Contract**: All renderers commit to consuming the blueprint structure
3. **No Raw YAML Access**: Renderers never read raw YAML directly
4. **Extensible**: New sections can be added without breaking existing renderers
5. **Serializable**: Blueprint can be written to JSON for audit trails and caching

### Benefits

- **Future Entities**: New entity types (Vendor, Project, Machine, Inventory, WorkOrder) all use the same IR
- **New Renderers**: Additional renderers (API controllers, GraphQL, migrations) consume the same blueprint
- **Validation**: Blueprint validation ensures consistent structure
- **Testability**: Blueprint can be tested independently of renderers
- **Auditability**: Generated blueprints provide complete metadata trace

## Usage

### Creating a Blueprint

```typescript
import { buildBlueprint } from './ir/BlueprintBuilder.mjs';

// After expanding metadata from YAML
const blueprint = buildBlueprint(
  'Customer',           // entityName
  rawMetadata,          // raw YAML metadata
  expandedFields,       // from FieldExpander
  expandedRelationships,// from RelationshipExpander
  expandedCapabilities, // from CapabilityExpander
  expandedLifecycle,    // from LifecycleExpander
  definitionPath        // source YAML path
);
```

### Validating a Blueprint

```typescript
import { validateBlueprint } from './ir/EnterpriseObjectBlueprint.mjs';

validateBlueprint(blueprint); // Throws if invalid
```

### Consuming in Renderers

All renderers follow the same pattern:

```typescript
// OLD (before IR):
export function generateRepository(entityName, fields, relationships, capabilities) {
  // ...
}

// NEW (with IR):
export function generateRepository(blueprint) {
  const entityName = blueprint.metadata.entity;
  const fields = blueprint.fields.all;
  const relationships = blueprint.relationships.all;
  const capabilities = blueprint.capabilities;
  // ...
}
```

## Implementation Checklist

- [x] Create `EnterpriseObjectBlueprint.mjs` - Blueprint type definitions and validation
- [x] Create `BlueprintBuilder.mjs` - Metadata expansion to blueprint conversion
- [x] Update `CodeGenerationEngine.mjs` - Build blueprint before rendering
- [x] Update `RepositoryRenderer.mjs` - Consume blueprint instead of raw parameters
- [x] Update `DocumentationRenderer.mjs` - Consume blueprint instead of raw parameters
- [ ] Update `ServiceRenderer.mjs` - Consume blueprint
- [ ] Update `ValidatorRenderer.mjs` - Consume blueprint
- [ ] Update `TestRenderer.mjs` - Consume blueprint
- [x] Create `BlueprintCompilationTest.mjs` - Test blueprint compilation for Customer
- [ ] Run full GDK test suite - Verify 61/61 tests pass
- [ ] Create additional renderers (API, GraphQL, migrations) consuming blueprint

## Testing

### Run Blueprint Tests

```bash
node --test test/BlueprintCompilationTest.mjs
```

### Generate Customer and Verify

```bash
node tools/genesis/genesis.mjs generate Customer
```

Check outputs:
- `out/generated/entities/Customer/CustomerRepository.ts` - Uses blueprint data
- `out/generated/entities/Customer/Customer.md` - Uses blueprint data
- `out/generated/entities/Customer/Customer.blueprint.json` - Blueprint IR
- `out/generated/entities/Customer/Customer.gen.json` - Metadata (backward compat)

## Future Directions

### Supporting New Entities

To add a new entity (e.g., Vendor):

1. Create `definitions/entity/Vendor.entity.yaml`
2. Run: `node tools/genesis/genesis.mjs generate Vendor`
3. All renderers automatically work with Vendor blueprint (no changes needed)

### New Renderers

To add a new renderer (e.g., GraphQL):

```typescript
export function generateGraphQL(blueprint) {
  const entityName = blueprint.metadata.entity;
  const fields = blueprint.fields.all;
  const relationships = blueprint.relationships.all;
  // Generate GraphQL schema...
}
```

Add to CodeGenerationEngine:
```typescript
const graphqlCode = generateGraphQL(blueprint);
// Write to file...
```

## Architecture Principles

1. **Clear Phases**: Expansion → Blueprint → Rendering
2. **Stable IR**: Blueprint never changes from a renderer's perspective
3. **No Leaky Abstractions**: Renderers don't peek at intermediate state
4. **Explicit Sections**: All entity metadata has explicit home
5. **Entity-Agnostic**: Works for Customer, Vendor, Project, Machine, etc.

## Conclusion

EnterpriseObjectBlueprint establishes the **stable compiler IR** for Genesis OS. All future development (new entities, new renderers) builds on this contract. The architecture ensures:

- ✅ Customer still compiles
- ✅ No renderer reads raw YAML
- ✅ Clear IR layer for all entities
- ✅ Foundation for Vendor, Project, Machine, Inventory, WorkOrder

---

_Genesis OS - Era IV Sprint 11 - Canonical Enterprise Object Blueprint_
