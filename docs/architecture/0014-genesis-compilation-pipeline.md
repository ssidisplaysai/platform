# Genesis Compilation Pipeline

**Architecture Decision Record (ADR):** 0014  
**Title:** Genesis Compilation Pipeline  
**Status:** Active  
**Version:** 1.0.0  
**Author:** Project Genesis  
**Created:** July 6, 2026  
**Last Updated:** July 6, 2026  
**Supersedes:** None

---

# Mission Statement

Genesis OS is not a website platform.

Genesis OS is not a CRM framework.

Genesis OS is a **business compiler**.

It transforms business definitions into enterprise artifacts through a metadata-driven compilation pipeline.

---

# Purpose

The Genesis Compilation Pipeline establishes how business definitions are transformed into consistent, maintainable, and extensible Genesis artifacts.

It ensures that:

- Business definitions are the single source of truth
- Compilation is reproducible and auditable
- Planning and execution are always separate
- Generated artifacts maintain architectural consistency
- The platform can evolve without redefining the business model

---

# Core Principle

**Model the business once. Compile everything else from it.**

---

# The Compilation Pipeline

The Genesis compilation process moves through ten distinct stages:

```
Business Definition
       ↓
Definition Registry
       ↓
Blueprint Resolver
       ↓
     Planner
       ↓
 Generation Plan
       ↓
    Compiler
       ↓
 Artifact Writers
       ↓
    Templates
       ↓
   Artifacts
       ↓
     Runtime
```

---

# Stage 1: Business Definition

A Business Definition is a metadata description of a business object.

Examples include:

- Customer
- Project
- Quote
- Vendor
- Inventory Item
- Task
- Employee
- Machine
- Asset
- Document

Business Definitions are human-authored or imported.

They capture:

- Entity type
- Fields and types
- Relationships
- Lifecycle
- Search configuration
- AI enablement
- Audit requirements
- Archive policies

---

# Stage 2: Definition Registry

The Definition Registry is the first stage of the compiler.

It:

- Loads definition candidates from configured root directories
- Creates an authoritative index of definitions
- Normalizes definition names (e.g., `CustomerDefinition` → `Customer`)
- Serves definitions to the planner, compiler, validator, and documentation engine

**Key Principle:** The compiler does not scan arbitrary files directly.

All file discovery and definition loading must go through the Definition Registry pipeline.

This ensures:

- Deterministic behavior
- Auditability of what gets loaded
- Ability to test without file system
- Clear separation between file discovery and compilation

The Definition Registry is the source of truth for what definitions are available.

---

# Stage 3: Blueprint Resolver

A Blueprint Resolver parses and validates definition candidates into actual blueprints.

The Blueprint Resolver:

- Reads definitions from the Definition Registry
- Validates syntax and structure
- Resolves relationships
- Checks for coherence
- Creates structured blueprint objects

The Blueprint is the validated, intermediate form that the Planner consumes.

---

# Stage 4: Planner

The Planner is the phase that creates a Generation Plan without executing it.

The Planner:

- Analyzes the Blueprint
- Determines what artifacts are needed
- Identifies dependencies and ordering
- Creates GenerationStep objects
- Produces an immutable Generation Plan
- **Does not execute anything**

**Key guarantee: Determinism**

Same blueprint always produces the same plan. Plans are:

- Reproducible — Run multiple times, get identical plans
- Auditable — Plans can be inspected and reviewed
- Testable — Plans can be compared and validated
- Immutable — Plans cannot be modified after creation

**The Planner does not write code or generate artifacts.**

It creates a declarative plan for later execution.

---

# Stage 5: Generation Plan

A Generation Plan is a deterministic, immutable specification of what artifacts to generate.

A plan contains:

- Ordered GenerationStep objects
- Artifact type for each step (entity, service, repository, schema, etc.)
- Target locations
- Dependency information
- Template bindings
- Configuration parameters
- Metadata

The Generation Plan is:

- **Human-readable** — Can be inspected in text form
- **Immutable** — Frozen after creation
- **Deterministic** — Same input → same plan
- **Inspectable** — Can be reviewed before execution

The Generation Plan is the contract between Planner and Compiler.

---

# Stage 6: Compiler

The Compiler is the execution phase that processes a Generation Plan.

**Phase 3 (Current):** Compiler operates in **dry-run mode only**.

In dry-run mode, the Compiler:

- Reads the Generation Plan
- Iterates through all GenerationSteps in order
- Creates artifact records for each step
- Produces diagnostics (info, warnings, errors)
- Returns an immutable Compilation Result
- **Does not write files**
- **Does not execute templates**

The dry-run Compiler is used to:

- Validate that all steps can be processed
- Inspect what would be generated
- Test plans before commit
- Ensure deterministic reproducibility

**Future (Phase 4+):** Compiler will execute templates and write artifacts.

The Compiler does not make planning decisions. It executes decisions made by the Planner.

---

# Stage 7: Artifact Writers

Artifact Writers serialize compiled artifacts to the file system.

They:

- Accept compiled artifacts
- Format them according to language/framework requirements
- Write to appropriate locations
- Handle overwrites or conflicts
- Report results

Artifact Writers are the bridge between compilation and the file system.

*(Phase 4+)*

---

# Stage 8: Templates

Templates are reusable code generation definitions.

They:

- Define artifact structure and content
- Accept metadata bindings
- Produce consistent, predictable output
- Support multiple artifact types
- Can be extended for custom artifacts

Templates are not runtime code.

They are generation-time specifications.

---

# Stage 9: Artifacts

Artifacts are the generated code, schemas, services, repositories, and configurations produced by the Compiler.

Artifacts include:

- Entity definitions
- Service implementations
- Repository implementations
- Database schemas
- API definitions
- Search configurations
- Automation rules
- Test scaffolding

Artifacts follow Genesis architecture standards.

---

# Stage 10: Runtime

Generated Artifacts are integrated into the Genesis Runtime.

The Runtime:

- Loads generated definitions
- Registers entities and services
- Validates artifact structure
- Orchestrates execution
- Ensures consistency with other platform components

---

# Governing Rules

## Rule 1: The Compiler Uses Definition Registry

The compiler must not scan arbitrary files directly.

All file discovery and definition loading must go through the Definition Registry pipeline.

This ensures:

- Deterministic and auditable loading
- Ability to test without file system
- Clear separation of concerns
- Single source of truth for definitions

---

## Rule 2: Planning and Execution Are Separate

The Planner must always run before the Compiler.

Planning decisions must be made, reviewed, and audited before code is generated.

The Generation Plan is the bridge between planning and execution.

---

## Rule 3: Plans Are Deterministic and Immutable

All Generation Plans must be deterministic.

Same blueprint → Same plan (always).

This ensures:

- **Reproducibility** — Plans can be recreated identically
- **Auditability** — Plans can be compared across time
- **Testability** — Plans can be validated and verified
- **Confidence** — Same business definition produces same artifacts

Plans are also immutable:

- Once created, plans cannot be modified
- If changes are needed, create a new plan
- Immutability guarantees safety and predictability

---

## Rule 4: Business Definitions Are Immutable During Planning

During planning, business definitions must not change.

This ensures plan consistency and auditability.

---

## Rule 5: Generated Code Follows Architecture

All generated artifacts must:

- Respect Clean Architecture boundaries
- Keep business logic in services
- Keep data access in repositories
- Keep UI presentation-focused
- Follow the Genesis domain model
- Comply with the Definition of Done

---

## Rule 6: Templates Are Version-Controlled

Templates are platform code, not artifacts.

They must be:

- Version-controlled
- Reviewed
- Tested
- Documented
- Evolved carefully

---

# The GDK Command Goal

The Genesis Development Kit provides a command-line interface to the compilation pipeline.

The primary command goal is:

```bash
node tools/genesis/genesis.mjs plan Customer
```

This command:

1. Loads the Customer Business Definition
2. Creates a Blueprint
3. Runs the Planner
4. Generates a Generation Plan
5. Reports the plan without executing it

---

# Future Commands

```bash
node tools/genesis/genesis.mjs generate Customer
```

Executes a generation plan and produces artifacts.

```bash
node tools/genesis/genesis.mjs validate Customer
```

Validates a Business Definition for completeness and correctness.

```bash
node tools/genesis/genesis.mjs explain Customer
```

Explains the compilation decisions for a given entity.

---

# Architectural Consequences

The Genesis Compilation Pipeline establishes:

- A clear separation between planning and execution
- Auditability of all generation decisions
- Consistency of generated artifacts
- Extensibility through templates
- Reproducibility of compilation results
- A framework for future compilation stages

---

# Why This Matters

A Business Compiler approach ensures that:

- The platform scales as business complexity grows
- New artifacts can be generated without manual effort
- Changes to business definitions propagate automatically
- Future modules, services, and applications are derived from the same business model
- The platform maintains consistency from business understanding through runtime execution

---

# Guiding Principle

"Model the business once. Compile everything else from it."