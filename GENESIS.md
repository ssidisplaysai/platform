# Genesis OS Development Rules

You are contributing to Genesis OS.

Genesis OS is a commercial enterprise operating system.

## Principles

- Enterprise-first architecture
- Never introduce technical debt
- Business logic belongs in Services
- Data access belongs in Repositories
- UI is presentation only
- Runtime orchestrates platform behavior
- Domain represents the business
- Infrastructure integrates external systems

## Coding Standards

- TypeScript only
- Strict typing
- No any
- Complete files only
- Small focused classes
- Composition over inheritance
- SOLID principles
- DRY
- Clean Architecture

## Folder Responsibilities

app/
Presentation

components/
Reusable UI

modules/
Business Applications

domain/
Business Concepts

core/
Platform Runtime

infrastructure/
External Systems

data/
Temporary Data Sources

## Runtime

Genesis Runtime is responsible for:

- Metadata
- Validation
- Discovery
- Search
- Events
- AI
- Plugins
- Automation

## Philosophy

Genesis is not an ERP.

Genesis is an Enterprise Operating System.

Every architectural decision should improve Genesis ten years from now.

## Enterprise Object Compiler

**Status:** ✅ **v1 VALIDATED**

Genesis includes a generic, metadata-driven Enterprise Object Compiler that automatically generates complete TypeScript data access layers and documentation from simple YAML entity definitions.

### Compiler Pipeline

```
Entity YAML Definition
        ↓
Metadata Expansion (generic)
- FieldExpander
- RelationshipExpander
- CapabilityExpander
- LifecycleExpander
        ↓
EnterpriseObjectBlueprint IR
(canonical contract, 11 explicit sections)
        ↓
Generic Renderers
- RepositoryRenderer
- DocumentationRenderer
        ↓
Generated Artifacts
- Repository (TypeScript)
- Documentation (Markdown)
- Blueprint IR (JSON)
- Metadata Cache (JSON)
```

### Key Features

- **Generic Pipeline:** Works for any entity metadata without code changes
- **Zero Entity-Specific Logic:** All business rules come from YAML
- **Canonical IR:** EnterpriseObjectBlueprint ensures renderer stability
- **Automatic Methods:** Finder methods, search, soft delete all auto-generated
- **Complete Code:** Full TypeScript with proper imports and typing
- **Full Documentation:** Auto-generated markdown with field/relationship details
- **Test Coverage:** 22 comprehensive tests validating compilation

### Proven Entities

- ✅ **Customer** - CRM domain (7 fields, 3 relationships)
- ✅ **Vendor** - Supply chain domain (17 fields, 4 relationships)

Both compile identically through the same generic pipeline without compiler modifications.

### Supported Future Entities

Ready for immediate compilation (no code changes needed):
- Project
- Machine
- Inventory
- WorkOrder
- Any other business object with YAML definition

### Documentation

- [EnterpriseObjectBlueprint IR](tools/genesis/compiler/ir/README.md) - Architecture and design
- [VENDOR_PROOF.md](VENDOR_PROOF.md) - Generic compiler validation proof
- [Blueprint Compilation Tests](test/BlueprintCompilationTest.mjs) - 22 test suite