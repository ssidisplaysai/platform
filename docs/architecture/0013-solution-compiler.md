# Genesis Solution Compiler v1

## Overview

The Genesis Solution Compiler is a metadata-driven compiler that assembles multiple compiled applications into complete, deployable enterprise solutions. It composes shared navigation, API catalogs, AI agent registries, branding, integrations, and global permissions from pre-compiled applications.

## Architecture

### Core Design Principles

1. **Metadata-Driven** - All composition logic driven by application metadata, no solution-specific logic
2. **Application Composition** - Solutions = aggregation of compiled applications
3. **Hierarchical** - Solutions contain applications, applications contain modules, modules contain objects
4. **Declarative** - Solution structure defined through metadata, not imperative code
5. **Shared Components** - Applications share navigation, APIs, agents, and permissions

### Compilation Hierarchy

```
Enterprise Objects (compiled entities with metadata)
    ↓
Modules (7 modules, each with ~7 objects)
    ↓
Applications (e.g., CRM: composed of 7 modules)
    ↓
Solutions (e.g., SSI: composed of CRM + ERP + Analytics apps)
    ↓
Deployable Enterprise System
```

### Compilation Pipeline

```
Application Discovery
    ↓
Load Application Manifests
    ↓
Validate Dependencies
    ↓
Identify Shared Components
    ↓
Assemble Blueprint
    ↓
Validate Blueprint
    ↓
Generate Manifest
    ↓
Generate Artifacts
    ↓
Deployable Solution
```

## Core Components

### SolutionBlueprint

Canonical Intermediate Representation (IR) for enterprise solutions.

**Properties:**
- `id` - Unique solution identifier
- `name` - Human-readable solution name
- `namespace` - Solution namespace for registration
- `version` - Solution version (semver)
- `description` - Solution description
- `status` - Current state (draft, validated, compiled, deployed)

**Aggregated Content:**
- `applications` - SolutionApplication[] references
- `entities` - Aggregated entities from all applications
- `apis` - Aggregated API endpoints from all applications
- `workflows` - Aggregated workflows from all applications
- `automations` - Aggregated automations from all applications
- `aiAgents` - Aggregated AI agents from all applications
- `dashboards` - Aggregated dashboards from all applications

**Shared Components:**
- `sharedNavigation` - Merged navigation structure from all applications
- `globalPermissions` - Solution-wide permission definitions
- `branding` - Solution branding and theming
- `integrations` - External system integrations

### SolutionApplication

Reference to a compiled application in a solution.

**Properties:**
- `id` - Application identifier
- `name` - Application name
- `namespace` - Application namespace
- `version` - Application version
- `description` - Application description
- `enabled` - Whether application is active
- `priority` - Application load priority

**Content References:**
- `modules` - Module references from application
- `apis` - API endpoints
- `workflows` - Workflow definitions
- `automations` - Automation definitions
- `dashboards` - Dashboard definitions
- `agents` - AI agent definitions
- `navigation` - Application navigation

### SharedModule

Module used by multiple applications in a solution.

**Properties:**
- `name` - Module name
- `namespace` - Module namespace
- `version` - Module version
- `applications` - Applications using this module
- `entities` - Module entities
- `apis` - Module API endpoints
- `shared` - Boolean indicating shared status

### SharedNavigation

Merged navigation structure from all applications.

**Properties:**
- `main` - Main navigation menu
- `admin` - Admin navigation
- `dashboards` - Dashboard navigation
- `reports` - Reports navigation
- `settings` - Settings navigation
- `custom` - Custom navigation sections

**Methods:**
- `merge(navData)` - Merge navigation from an application

### SharedAPI

API endpoint shared across multiple applications.

**Properties:**
- `method` - HTTP method (GET, POST, PUT, DELETE)
- `path` - API endpoint path
- `operation` - Operation name
- `module` - Source module
- `applications` - Applications providing endpoint
- `shared` - Boolean if used by multiple applications

### SharedAgent

AI agent available across the solution.

**Properties:**
- `id` - Agent identifier
- `name` - Agent name
- `type` - Agent type (assistant, analyst, etc.)
- `module` - Source module
- `applications` - Applications using agent
- `model` - LLM model (gpt-4, etc.)

### GlobalPermission

Solution-wide permission definition.

**Properties:**
- `name` - Permission name
- `resource` - Resource being protected
- `actions` - Allowed actions (read, create, update, delete)
- `roles` - Roles that have permission
- `scope` - Scope level (solution, application, module)
- `conditions` - Conditional rules

### SolutionBranding

Solution branding and theming.

**Properties:**
- `name` - Brand name
- `logo` - Logo URL
- `favicon` - Favicon URL
- `companyName` - Company name
- `companyUrl` - Company website
- `supportEmail` - Support email
- `colors` - Color palette (primary, secondary, success, danger, warning, info)
- `theme` - Theme configuration

### SolutionIntegration

External system integration.

**Properties:**
- `name` - Integration name
- `type` - Integration type (crm, erp, billing, analytics, etc.)
- `enabled` - Whether integration is active
- `endpoint` - Integration endpoint URL
- `apiKey` - API key for authentication
- `applications` - Applications using integration
- `config` - Integration configuration

### SolutionManifest

Generated runtime manifest for deployed solution.

**Content:**
- `solution` - Solution identification
- `applications` - Registered applications
- `modules` - All modules
- `entities` - All entities
- `apis` - All API endpoints
- `workflows` - All workflows
- `automations` - All automations
- `aiAgents` - All AI agents
- `dashboards` - All dashboards
- `navigation` - Complete navigation structure
- `permissions` - All permissions
- `branding` - Branding configuration
- `integrations` - Integration definitions

**Metadata:**
- `statistics` - Composition statistics
- `metadata` - Additional metadata

## SolutionCompiler Implementation

### Stage 1: Application Discovery

Discovers all compiled applications in `out/generated/applications/`.

```javascript
discoverApplications() {
  // List all directories in out/generated/applications/
  // Each directory represents a compiled application
  // Returns array of application names
}
```

### Stage 2: Load Application Manifests

Loads manifests from each discovered application.

**Files loaded:**
- `{appName}.application.json` - Application manifest
- `{appName}.blueprint.json` - Application blueprint (metadata)

### Stage 3: Application Dependency Validation

Validates that all applications can coexist without conflicts.

```javascript
validateApplicationDependencies() {
  // For each application
  // Validate all module references
  // Check for missing or incompatible dependencies
}
```

### Stage 4: Identify Shared Components

Identifies components used by multiple applications.

```javascript
identifySharedComponents() {
  // Count occurrences of each module
  // Count occurrences of each API
  // Count occurrences of each agent
  // Mark components used by 2+ applications as "shared"
}
```

### Stage 5: Blueprint Assembly

Assembles SolutionBlueprint from all applications.

```javascript
assembleBlueprint() {
  // Create new blueprint with solution metadata
  // For each discovered application
  //   Add application reference
  //   Aggregate entities
  //   Aggregate APIs
  //   Aggregate workflows
  //   Aggregate automations
  //   Aggregate dashboards
  //   Merge navigation structures
  //   Aggregate agents
  // Return assembled blueprint
}
```

### Stage 6: Blueprint Validation

Validates the assembled blueprint.

- All required fields present
- At least one application
- All application validations pass
- All permission validations pass
- Branding color validations pass
- Integration validations pass

### Stage 7: Manifest Generation

Generates SolutionManifest from blueprint.

```javascript
generateManifest() {
  // Create manifest with all blueprint content
  // Add statistics
  // Calculate sizes and counts
  // Mark as valid
}
```

### Stage 8: Artifact Generation

Generates deployment artifacts:

- `{solutionNamespace}.solution.json` - Solution Manifest
- `{solutionNamespace}.blueprint.json` - Blueprint summary
- `{solutionNamespace}.navigation.json` - Shared navigation
- `{solutionNamespace}.api-catalog.json` - API catalog
- `{solutionNamespace}.ai-catalog.json` - AI agent catalog
- `{solutionNamespace}.branding.json` - Branding configuration
- `{solutionNamespace}.summary.txt` - Text summary

## Generated Artifacts

### Solution Manifest

Main runtime artifact containing complete solution definition.

```json
{
  "manifestId": "manifest-...",
  "version": "1.0.0",
  "generatedAt": "2026-07-08T...",
  "status": "validated",
  "solution": {
    "id": "solution-ssi",
    "name": "SSI",
    "namespace": "ssi",
    "version": "1.0.0"
  },
  "applications": [
    { "name": "CRM", "namespace": "crm", "version": "1.0.0" },
    { "name": "ERP", "namespace": "erp", "version": "1.0.0" },
    ...
  ],
  "statistics": {
    "totalApplications": 3,
    "totalModules": 21,
    "totalApis": 147,
    ...
  }
}
```

### Blueprint Summary

Quick reference of solution structure.

```json
{
  "blueprintId": "blueprint-...",
  "id": "solution-ssi",
  "name": "SSI",
  "namespace": "ssi",
  "applicationsCount": 3,
  "entitiesCount": 84,
  "apisCount": 147,
  "status": "compiled"
}
```

### Shared Navigation

Merged navigation from all applications.

```json
{
  "version": "1.0.0",
  "solutionId": "solution-ssi",
  "navigation": {
    "main": [...],
    "admin": [...],
    "dashboards": [...]
  }
}
```

### API Catalog

Complete API surface of the solution.

```json
{
  "version": "1.0.0",
  "solutionId": "solution-ssi",
  "totalEndpoints": 147,
  "endpoints": [...]
}
```

### AI Catalog

All AI agents in the solution.

```json
{
  "version": "1.0.0",
  "solutionId": "solution-ssi",
  "totalAgents": 5,
  "agents": [...]
}
```

### Branding Configuration

Solution branding and theming.

```json
{
  "version": "1.0.0",
  "solutionId": "solution-ssi",
  "branding": {
    "name": "SSI",
    "logo": "https://...",
    "colors": {
      "primary": "#007AFF",
      "secondary": "#5AC8FA"
    }
  }
}
```

## CLI Usage

### Compile Solution

```bash
node tools/genesis/genesis.mjs compile solution SSI
```

**Output:**
- Solution Manifest generated to `out/generated/solutions/ssi/`
- Blueprint summary
- Shared navigation structure
- API catalog
- AI agent catalog
- Branding configuration
- Text summary with statistics

### Example Output

```
≡ƒÜÇ Genesis Solution Compiler v1 - Compiling 'SSI'

Stage 1: Application Discovery
  ✓ Discovered 3 applications

Stage 2: Load Application Manifests
  ✓ Loaded manifests for 3 applications

Stage 3: Application Dependency Validation
  ✓ All dependencies validated

Stage 4: Identify Shared Components
  ✓ Shared components identified

Stage 5: Solution Blueprint Assembly
  ✓ Blueprint assembled

Stage 6: Blueprint Validation
  ✓ Blueprint validated

Stage 7: Generate Solution Manifest
  ✓ Manifest generated

Stage 8: Generate Solution Artifacts
  ✓ Artifacts generated

≡ƒôè SOLUTION COMPILATION COMPLETED

  Solution: SSI
  Namespace: ssi
  Version: 1.0.0
  Applications: 3
  Modules: 21
  Entities: 84
  APIs: 147
  Integrations: 5

GENERATED ARTIFACTS:
  • ssi.solution.json - Solution Manifest
  • ssi.blueprint.json - Solution Blueprint
  • ssi.navigation.json - Shared Navigation
  • ssi.api-catalog.json - API Catalog
  • ssi.ai-catalog.json - AI Catalog
  • ssi.branding.json - Branding Configuration
```

## Runtime Integration

### Solution Bootstrap

1. Runtime loads SolutionManifest
2. Registers all applications
3. Initializes all modules
4. Loads all entities
5. Loads all APIs into API Gateway
6. Registers all workflows
7. Registers all automations
8. Registers all AI agents
9. Builds complete navigation
10. Applies branding configuration
11. Initializes integrations

### Application Registration

Each application in the solution is registered with:

- Application name and namespace
- Application version
- Module references
- Entity definitions
- API endpoints
- Workflow definitions
- Automation definitions
- AI agent definitions
- Dashboard definitions

### Navigation Structure

Solution navigation is merged from all applications:

```json
{
  "main": [
    {
      "label": "CRM",
      "items": [...]
    },
    {
      "label": "ERP",
      "items": [...]
    },
    ...
  ]
}
```

## Validation Rules

### Blueprint Validation
- Solution ID required
- Solution name required
- Solution namespace required
- At least one application required
- All application validations pass
- All permission validations pass
- Branding color validations pass
- All integration validations pass

### Application Validation
- Application name required
- Application namespace required
- At least one module referenced

### Manifest Validation
- Solution info required
- At least one application
- Statistics match content counts

## Error Handling

### Discovery Errors
- Applications directory not found
- Application manifest missing
- Corrupted JSON files

### Dependency Errors
- Application incompatibility
- Module version conflicts
- Permission conflicts

### Validation Errors
- Missing required fields
- Invalid data types
- Invalid color formats
- Circular dependencies

## Performance Characteristics

- **Application Discovery**: O(1) file system scan
- **Manifest Loading**: O(n) per application
- **Dependency Validation**: O(n) linear check
- **Blueprint Assembly**: O(n*m) where n=apps, m=content per app
- **Manifest Generation**: O(n) linear aggregation
- **Total Compilation**: ~200-800ms for typical 3-application solution

## Files

- `tools/genesis/compiler/SolutionBlueprintContract.mjs` - Contract definitions (~450 lines)
- `tools/genesis/compiler/SolutionCompiler.mjs` - Compiler implementation (~500 lines)
- `tools/genesis/commands/compile.mjs` - CLI support (updated)
- `tools/genesis/tests/suites/SolutionCompilerTests.mjs` - Test suite (20 tests)
- `docs/architecture/0013-solution-compiler.md` - This documentation

## Testing

The Solution Compiler test suite (20 tests) covers:

1. Blueprint initialization
2. Blueprint validation
3. Application validation
4. Navigation validation and merging
5. Global permission validation
6. Branding color validation
7. Integration validation
8. Application aggregation
9. Status transitions
10. Manifest initialization
11. Manifest validation
12. Compiler initialization
13. Application discovery
14. Blueprint summary
15. Manifest serialization
16. Compiler results
17-20. Additional edge cases and error handling

All tests pass with zero failures.

## Success Criteria ✅

- ✅ Solution Compiler exists
- ✅ Discovers compiled applications from metadata
- ✅ Assembles SolutionBlueprint
- ✅ Generates Solution Manifest
- ✅ Creates deployment artifacts
- ✅ Validates all components
- ✅ CLI works (`compile solution SSI`)
- ✅ Full test suite passes (20/20)
- ✅ No regressions in other components

## Related Documentation

- [0001-genesis-architecture.md](0001-genesis-architecture.md) - Overall system architecture
- [0002-folder-structure.md](0002-folder-structure.md) - Project structure
- [0003-runtime.md](0003-runtime.md) - Runtime boot
- [0004-domain-model.md](0004-domain-model.md) - Domain model
- [0005-metadata-engine.md](0005-metadata-engine.md) - Metadata management
- [0006-plugin-architecture.md](0006-plugin-architecture.md) - Plugin architecture
- [0007-event-engine.md](0007-event-engine.md) - Event engine
- [0008-ai-runtime.md](0008-ai-runtime.md) - AI runtime
- [0009-workflow-engine.md](0009-workflow-engine.md) - Workflow engine
- [0010-automation-engine.md](0010-automation-engine.md) - Automation engine
- [0011-api-gateway.md](0011-api-gateway.md) - API Gateway
- [0012-application-compiler.md](0012-application-compiler.md) - Application Compiler
