# Genesis Business Compiler (GDK)

The Genesis Development Kit is a metadata-driven compilation pipeline for entity-oriented code generation.

**Core Principle:** Model the business once. Compile everything else from it.

## Architecture Overview

The GDK pipeline has four phases:

```
Phase 1: Definition Registry
  ↓
Phase 2: Generation Planner
  ↓
Phase 3: Generation Compiler (Dry-Run)
  ↓
Phase 4: Artifact Writer (Isolated Output)
```

## How The Registry Works

The Definition Registry (Phase 1) loads and indexes business entity definitions.

It:

1. Scans configured definition roots
2. Loads definition files deterministically
3. Normalizes definition names
4. Provides O(1) lookup access
5. Returns sorted lists for deterministic iteration

**Key guarantee:** Definitions are indexed deterministically. Same filesystem state → same registry state.

See [tools/genesis/compiler/registry/README.md](compiler/registry/README.md) for details.

## How The Planner Works

The Generation Planner (Phase 2) creates immutable, deterministic plans without executing anything.

It:

1. Accepts a definition and context
2. Determines what artifacts are needed
3. Creates ordered GenerationSteps (9 steps for entities)
4. Produces an immutable GenerationPlan
5. Returns the plan to the caller

**Key guarantee:** Same definition → Same plan (always). Plans are deterministic and reproducible.

See [tools/genesis/compiler/planner/README.md](compiler/planner/README.md) for details.

The plan describes what should be created but does NOT create artifacts.

## How The Compiler Works

The Generation Compiler executes a Generation Plan through multiple phases.

**Phase 3 (Dry-Run Planning):**
- Executes plans in dry-run mode only
- Creates artifact records with placeholder content
- Does not write to file system

**Phase 4 (Isolated Output):**
- Extends compiler with write mode support
- Writes placeholder artifacts to isolated `generated/genesis/<Entity>/` directory
- Dry-run is still default
- Writing requires explicit `--write` flag

**Phase 5 (Template Rendering):**
- Renders entity templates for artifact generation
- Token replacement: `{{EntityName}}`, `{{entityName}}`, `{{entityNameLower}}`, `{{EntityNameUpper}}`, `{{EntityNamePlural}}`, `{{GeneratedAt}}`
- 9 reusable templates under `tools/genesis/templates/entity/`
- Generated artifacts contain template-based placeholder code (not real business logic)
- Fallback to plain placeholders if template rendering fails

The compiler:

1. Accepts a Generation Plan and execution context
2. Iterates over planned steps in order
3. **Renders templates with token replacement** (Phase 5)
4. Creates artifact records for each step
5. Conditionally writes artifacts (if mode is "write")
6. Produces diagnostics for all operations
7. Returns an immutable Compilation Result

**Entity Templates (Phase 5):**

9 reusable templates for entity artifacts:
- `definition.template.ts` - Entity schema definition
- `repository.template.ts` - Data access layer
- `service.template.ts` - Business logic layer
- `validator.template.ts` - Validation logic
- `events.template.ts` - Domain events
- `permissions.template.ts` - Access control
- `search.template.ts` - Search and filtering
- `documentation.template.md` - API documentation
- `tests.template.ts` - Unit tests

**Token Replacement:**

Templates support simple token replacement:
- `{{EntityName}}` → PascalCase entity name (e.g., `Customer`)
- `{{entityName}}` → camelCase entity name (e.g., `customer`)
- `{{entityNameLower}}` → lowercase entity name (e.g., `customer`)
- `{{EntityNameUpper}}` → UPPERCASE entity name (e.g., `CUSTOMER`)
- `{{EntityNamePlural}}` → PascalCase plural (e.g., `Customers`)
- `{{GeneratedAt}}` → ISO timestamp

**Artifact Writers:**

The Artifact Writer subsystem handles safe, controlled writing of artifacts:
- Validates all artifacts before writing
- Creates directories as needed
- Skips existing files unless `force` is specified
- Returns detailed write results
- Supports both dry-run and write modes
- **All artifacts are written under `generated/genesis/<Entity>/`**
- Does not touch `src/`, `docs/`, or `runtime/` directories

See [tools/genesis/compiler/writers/README.md](compiler/writers/README.md) for details.

## Current Commands

```bash
node tools/genesis/genesis.mjs doctor
```

The `doctor` command validates workspace health.

```bash
node tools/genesis/genesis.mjs plan Customer
```

The `plan` command creates an immutable generation plan:

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

```bash
node tools/genesis/genesis.mjs compile Customer
```

The `compile` command compiles a plan in **dry-run mode** (default):

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

**Dry-run mode** shows what would be generated without making changes.

```bash
node tools/genesis/genesis.mjs compile Customer --write
```

The `compile --write` command compiles a plan and **writes placeholder artifacts**:

```
Genesis Compiler v0.1

Compiling Entity

Customer

Mode
write

✓ Definition written
✓ Repository written
✓ Service written
✓ Validator written
✓ Events written
✓ Permissions written
✓ Search written
✓ Documentation written
✓ Tests written

Compilation Complete

9 Artifacts Written
```

**Write mode** creates placeholder files in an isolated directory:

### Artifact Location

All Phase 4 placeholder artifacts are written under:

```
generated/genesis/<Entity>/
├── <Entity>Definition.ts
├── <Entity>Repository.ts
├── <Entity>Service.ts
├── <Entity>Validator.ts
├── <Entity>Events.ts
├── <Entity>Permissions.ts
├── <Entity>Search.ts
├── <Entity>Documentation.md
└── <Entity>.test.ts
```

**Benefits:**
- Generated files are isolated from source code
- Artifacts can be deleted without affecting production
- Easy to validate generated output
- Reversible — no changes to existing code
- Phase 4 placeholder artifacts only (no business logic)

### Write Mode Behavior

- Creates directories as needed
- Generates placeholder content (clearly marked as Phase 4)
- Skips files that already exist
- Use `--force` flag to overwrite existing files (future)

### Safety Rules

- **Dry-run is default** — Must explicitly use `--write` to make changes
- **Templates only** — Phase 5 renders templates, not real business logic
- **No overwrites** — Existing files are never replaced without `--force`
- **Isolated output** — Never touches `src/`, `docs/`, `runtime/` directories
- **Reversible** — Delete generated files to revert

## Phase 6: Generated Slice Validation

```bash
node tools/genesis/genesis.mjs validate generated Customer
```

The `validate` command validates sandbox-generated entity slices (Phase 6).

It checks that all 9 required artifact files exist under `generated/genesis/<Entity>/`:

**Success output:**

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

**Failure output (missing files):**

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

**Exit codes:**
- `0` — All checks passed (slice is healthy)
- `1` — One or more checks failed (slice has issues)

**Validation checks:**

The validator verifies the existence of these files under `generated/genesis/{Entity}/`:

1. `{Entity}Definition.ts` — Entity schema definition
2. `{Entity}Repository.ts` — Data access layer
3. `{Entity}Service.ts` — Business logic layer
4. `{Entity}Validator.ts` — Validation logic
5. `{Entity}Events.ts` — Domain events
6. `{Entity}Permissions.ts` — Access control
7. `{Entity}Search.ts` — Search and filtering
8. `{Entity}Documentation.md` — API documentation
9. `{Entity}Tests.ts` — Unit tests

**Validator guarantees:**
- Read-only operation (never modifies files)
- Never moves files into `src/core`
- No runtime integration
- No CRM implementation
- No production entity integration
- Only validates files under `generated/genesis/`

See [tools/genesis/validators/generated-slice/README.md](validators/generated-slice/README.md) for details.



When you run `compile Customer --write`, templates render with token replacement:

**CustomerDefinition.ts** (rendered from `definition.template.ts`):
```typescript
export const CustomerDefinition: EntitySchema = {
  entityType: "customer",
  businessIdPrefix: "CUSTOMER",
  description: "Customer entity definition (Phase 5 template placeholder)",
  // ...
};
```

**CustomerService.ts** (rendered from `service.template.ts`):
```typescript
export class CustomerService {
  private repository = customerRepository;

  async get(id: string): Promise<Customer | null> {
    return this.repository.findById(id);
  }

  async list(): Promise<Customer[]> {
    return this.repository.findAll();
  }
  // ... other methods
}
```

**CustomerRepository.ts** (rendered from `repository.template.ts`):
```typescript
export class CustomerRepository {
  async findById(id: string): Promise<Customer | null> {
    throw new Error("CustomerRepository.findById not implemented");
  }

  async create(data: Partial<Customer>): Promise<Customer> {
    throw new Error("CustomerRepository.create not implemented");
  }
  // ... other methods
}
```

All generated files are marked as Phase 5 placeholders and contain:
- `Generated at {{GeneratedAt}}` timestamp
- Clear indication that no business logic is implemented yet
- Stub methods that throw "not implemented" errors
- Proper TypeScript interfaces and types

## Example Workflow

```bash
# 1. Check workspace health
node tools/genesis/genesis.mjs doctor

# 2. Plan a new entity
node tools/genesis/genesis.mjs plan Customer

# 3. Preview generated artifacts (dry-run)
node tools/genesis/genesis.mjs compile Customer

# 4. Write template-rendered artifacts
node tools/genesis/genesis.mjs compile Customer --write

# 5. Validate the generated slice
node tools/genesis/genesis.mjs validate generated Customer

# 6. Review generated files
ls generated/genesis/Customer/

# 7. Plan and write another entity
node tools/genesis/genesis.mjs compile Project --write

# 8. Validate the new slice
node tools/genesis/genesis.mjs validate generated Project

# 9. Delete generated artifacts (revert)
rm -r generated/genesis/Customer
rm -r generated/genesis/Project
```

## Future Phases

```bash
node tools/genesis/genesis.mjs generate Customer
```

The `generate` command will execute templates and produce real code.

```bash
node tools/genesis/genesis.mjs validate Customer
node tools/genesis/genesis.mjs explain Customer
```

Additional commands for validation and explanation of generated artifacts.

## Constraints (Phase 4)

✅ No third-party packages — Uses only Node.js built-ins
✅ No runtime integration — MetadataRuntime untouched
✅ No real entity generation — Placeholders only
✅ No CRM vertical slice — Generic entity compilation
✅ No React/UI — Backend-only operations
✅ Isolated output — `generated/` directory only

## Architecture Documents

- [ADR 0011: Meta Model](../../docs/architecture/0011-meta-model.md)
- [ADR 0012: Core Capability Model](../../docs/architecture/0012-core-capability-model.md)
- [ADR 0013: Genesis Development Kit](../../docs/architecture/0013-genesis-development-kit.md)
- [ADR 0014: Genesis Compilation Pipeline](../../docs/architecture/0014-genesis-compilation-pipeline.md)
