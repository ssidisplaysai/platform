# Genesis Development Kit

**Architecture Decision Record (ADR):** 0013  
**Title:** Genesis Development Kit  
**Status:** Active  
**Version:** 1.0.0  
**Author:** Project Genesis  
**Created:** July 6, 2026  
**Last Updated:** July 6, 2026  
**Supersedes:** None

---

# Mission Statement

The Genesis Development Kit (GDK) is the central development and compilation tool for Genesis OS.

It is the single interface through which platform architects, developers, and automation systems interact with Genesis.

---

# Purpose

The GDK exists to:

- Eliminate manual, repetitive development work
- Ensure consistency across all generated artifacts
- Make Genesis extensible and maintainable
- Enable rapid prototyping and iteration
- Provide clear feedback on system health

---

# GDK as a Business Compiler

The GDK is not a code generator.

It is a **business compiler** that transforms business definitions into enterprise artifacts.

The distinction is critical:

| Code Generator | Business Compiler |
|---|---|
| Reads schemas, produces boilerplate | Reads business definitions, produces entire systems |
| Limited to one output type | Produces entities, services, repositories, workflows, UI, automation |
| Often requires manual refinement | Produces production-ready artifacts |
| Standalone tool | Integrated with runtime and development workflow |
| Creates code | Creates systems |

---

# Core Commands

## doctor

Workspace health check and architecture validation.

```bash
node tools/genesis/genesis.mjs doctor
```

Verifies that the Genesis workspace has the required:
- Documentation structure
- Architecture decisions
- Runtime components
- GDK tooling

Exit code: 0 if healthy, 1 if issues found.

---

## plan

Create a generation plan without executing it.

```bash
node tools/genesis/genesis.mjs plan Customer
```

Produces a declarative plan for:
- What artifacts will be generated
- In what order
- With what dependencies

Plans are auditable and can be inspected before execution.

---

## generate

Execute a generation plan and produce artifacts.

```bash
node tools/genesis/genesis.mjs generate Customer
```

Reads a generation plan and produces:
- Entity definitions
- Service implementations
- Repository implementations
- Database schemas
- API definitions
- Search configurations

---

## validate

Validate a business definition.

```bash
node tools/genesis/genesis.mjs validate Customer
```

Checks that a business definition:
- Has correct syntax
- Includes required fields
- Has valid field types
- Defines valid relationships
- Has complete lifecycle

---

## explain

Explain compilation decisions.

```bash
node tools/genesis/genesis.mjs explain Customer
```

Reports:
- What artifacts will be generated
- Why each artifact is needed
- Which templates will be used
- What dependencies exist

---

# GDK Subsystems

### commands/

Command implementations for the CLI interface.

Each command is self-contained and exports a single async function.

```
commands/
  doctor.mjs          # Workspace health check
  plan.mjs            # Generation planning
  generate.mjs        # Artifact generation
  validate.mjs        # Definition validation
  explain.mjs         # Compilation explanation
```

---

### compiler/

The business compilation subsystem.

```
compiler/
  planner/            # Generation planning phase
  compiler/           # Core compilation logic
  renderer/           # Template rendering
  writers/            # Artifact writing
  diagnostics/        # Error reporting and diagnostics
```

---

### blueprints/

Business definition templates and examples.

```
blueprints/
  Customer.blueprint.md
  Project.blueprint.md
  Quote.blueprint.md
```

---

### templates/

Code generation templates.

```
templates/
  entity.ts.tmpl
  service.ts.tmpl
  repository.ts.tmpl
  schema.sql.tmpl
  api.ts.tmpl
```

---

### registry/

Registries for entities, definitions, and templates.

```
registry/
  entities.mjs
  definitions.mjs
  templates.mjs
```

---

### validators/

Validation rules and schemas.

```
validators/
  definition-validator.mjs
  schema-validator.mjs
  template-validator.mjs
```

---

### utils/

Shared utility functions.

```
utils/
  path-utils.mjs
  file-utils.mjs
  string-utils.mjs
  template-utils.mjs
```

---

# GDK Integration Points

The GDK integrates with Genesis at these points:

### MetadataRuntime

Loads business definitions and boots the Genesis runtime.

GDK commands feed definitions to the runtime for validation and registration.

### Registry

Stores entity definitions, making them accessible to the runtime and GDK.

### Services and Repositories

Generated services and repositories integrate directly with the runtime.

No glue code or adapters needed.

---

# GDK Design Principles

### Principle 1: Separation of Concerns

Planning is separate from execution.

Compilation is separate from runtime.

Generation is separate from integration.

---

### Principle 2: Auditability

Every decision is recorded and can be explained.

Plans are inspectable before execution.

Changes are tracked and versioned.

---

### Principle 3: Extensibility

New commands can be added without modifying existing ones.

New templates can be added without changing the compiler.

New validators can be added to enforce custom rules.

---

### Principle 4: Determinism

Same input always produces same output.

Generation is repeatable and reliable.

Version-controlled templates ensure consistency.

---

# Command Lifecycle

All GDK commands follow this lifecycle:

```
1. Parse arguments
2. Validate input
3. Load definitions
4. Run checks/planning
5. Report results
6. Exit with appropriate code
```

---

# Error Handling

GDK commands exit with:

- **0** — Success
- **1** — Command failed (error reported)
- **2** — Usage error (help printed)

Errors are always reported with:
- What failed
- Why it failed
- How to fix it

---

# Future Capabilities

The GDK roadmap includes:

- **version** — Report Genesis version and component versions
- **init** — Initialize a new Genesis workspace
- **migrate** — Migrate between Genesis versions
- **refactor** — Apply architectural refactoring
- **optimize** — Optimize generated code
- **test** — Run workspace tests
- **lint** — Lint definitions and code
- **format** — Format definitions and code
- **package** — Package artifacts for deployment
- **plugin** — Manage installed plugins

---

# Guiding Principle

"The GDK makes Genesis. Genesis makes everything else."
