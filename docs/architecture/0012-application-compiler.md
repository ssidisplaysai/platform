# Genesis Application Compiler v1

## Overview

The Genesis Application Compiler is a metadata-driven compiler that assembles multiple compiled modules into complete, deployable enterprise applications. It composes navigation structures, dashboards, API surfaces, workflows, automations, and AI agents from pre-compiled module metadata.

## Architecture

### Core Design Principles

1. **Metadata-Driven** - All composition logic driven by module metadata, no application-specific logic
2. **Modular Composition** - Applications = aggregation of compiled modules
3. **Hierarchical** - Applications contain modules, modules contain objects, objects contain fields
4. **Declarative** - Application structure defined through metadata, not imperative code

### Compilation Pipeline

```
Module Discovery
    ↓
Load Module Metadata
    ↓
Validate Dependencies
    ↓
Resolve Conflicts
    ↓
Assemble Blueprint
    ↓
Validate Blueprint
    ↓
Generate Manifest
    ↓
Generate Artifacts
    ↓
Deployable Application
```

## Core Components

### ApplicationBlueprint

Canonical Intermediate Representation (IR) for applications.

**Properties:**
- `id` - Unique application identifier
- `name` - Human-readable application name
- `namespace` - Application namespace for registration
- `version` - Application version (semver)
- `description` - Application description
- `status` - Current state (draft, validated, compiled, deployed)

**Aggregated Content:**
- `modules` - ApplicationModule[] references with configuration
- `entities` - Aggregated entities from all modules
- `apis` - Aggregated API endpoints from all modules
- `workflows` - Aggregated workflows from all modules
- `automations` - Aggregated automations from all modules
- `aiAgents` - Aggregated AI agents from all modules
- `dashboards` - Aggregated dashboards from all modules
- `navigation` - Merged navigation structure from all modules

**Configuration:**
- `permissions` - Application-level permissions
- `theme` - Application-wide theme configuration
- `settings` - Application configuration settings

### ApplicationModule

Reference to a compiled module in the application.

**Properties:**
- `name` - Module name
- `namespace` - Module namespace
- `version` - Module version
- `description` - Module description
- `enabled` - Whether module is active
- `priority` - Module load priority
- `config` - Module-specific configuration

**Content:**
- `entities` - Module entities
- `apis` - Module API endpoints
- `workflows` - Module workflows
- `automations` - Module automations
- `dashboards` - Module dashboards
- `agents` - Module AI agents
- `navigation` - Module navigation structure
- `dependencies` - Module dependencies (other modules required)

### ApplicationDependency

Module dependency definition.

**Properties:**
- `moduleName` - Required module name
- `requiredVersion` - Minimum required version
- `type` - Dependency type (required, optional)

### ApplicationPermission

Application permission definition.

**Properties:**
- `name` - Permission name
- `resource` - Resource being protected
- `actions` - Allowed actions (read, create, update, delete)
- `roles` - Roles that have permission
- `conditions` - Conditional rules

### ApplicationTheme

Application UI theme configuration.

**Properties:**
- `name` - Theme name
- `primaryColor` - Primary color (hex)
- `secondaryColor` - Secondary color (hex)
- `backgroundColor` - Background color (hex)
- `textColor` - Text color (hex)
- `accentColor` - Accent color (hex)
- `fontFamily` - Font family
- `borderRadius` - Border radius
- `shadowDepth` - Shadow depth

### ApplicationSetting

Application configuration setting.

**Properties:**
- `key` - Setting key
- `value` - Setting value
- `type` - Value type (string, number, boolean, object)
- `description` - Setting description
- `defaultValue` - Default value

### ApplicationManifest

Generated runtime manifest for deployed application.

**Content:**
- `application` - Application identification
- `blueprint` - Reference to source blueprint
- `modules` - Registered modules
- `entities` - All entities
- `apis` - All API endpoints
- `workflows` - All workflows
- `automations` - All automations
- `aiAgents` - All AI agents
- `navigation` - Complete navigation structure
- `dashboards` - All dashboards

**Metadata:**
- `statistics` - Composition statistics
- `permissions` - Permission definitions
- `theme` - Theme configuration
- `settings` - Configuration settings

## ApplicationCompiler Implementation

### Stage 1: Module Discovery

Discovers all compiled modules in `out/generated/modules/`.

```javascript
discoverModules() {
  // List all directories in out/generated/modules/
  // Each directory represents a compiled module
  // Returns array of module names
}
```

### Stage 2: Load Module Metadata

Loads metadata from each discovered module.

**Files loaded:**
- `{moduleName}.module.json` - Module definition
- `{moduleName}.api.json` - API surface
- `{moduleName}.workflow.json` - Workflows
- `{moduleName}.automation.json` - Automations
- `{moduleName}.dashboard.json` - Dashboards
- `{moduleName}.navigation.json` - Navigation
- `{moduleName}.agent.json` - AI agents

### Stage 3: Dependency Validation

Validates that required dependencies are satisfied.

```javascript
validateDependencies() {
  // For each module
  // For each required dependency
  // Check that dependency module is available
  // Report missing dependencies as errors
}
```

### Stage 4: Conflict Resolution

Detects and resolves conflicts between modules.

**Conflict types:**
- Namespace collisions
- Duplicate entity names
- Conflicting permission definitions
- Navigation structure conflicts

### Stage 5: Blueprint Assembly

Assembles ApplicationBlueprint from all modules.

```javascript
assembleBlueprint() {
  // Create new blueprint with application metadata
  // For each discovered module
  //   Add module reference
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
- All modules valid
- All permissions valid
- Theme colors valid
- Settings types match values
- No circular dependencies

### Stage 7: Manifest Generation

Generates ApplicationManifest from blueprint.

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

- `{appNamespace}.application.json` - Application Manifest
- `{appNamespace}.blueprint.json` - Blueprint summary
- `{appNamespace}.navigation.json` - Navigation contract
- `{appNamespace}.dashboards.json` - Dashboard contract
- `{appNamespace}.api-surface.json` - API surface summary
- `{appNamespace}.summary.txt` - Text summary

## Generated Artifacts

### Application Manifest

Main runtime artifact containing complete application definition.

```json
{
  "manifestId": "manifest-...",
  "version": "1.0.0",
  "generatedAt": "2026-07-08T...",
  "application": {
    "id": "app-crm",
    "name": "CRM",
    "namespace": "crm",
    "version": "1.0.0"
  },
  "modules": [
    { "name": "crm", "namespace": "crm", "version": "1.0.0" },
    ...
  ],
  "entities": [...],
  "apis": [...],
  "workflows": [...],
  "automations": [...],
  "aiAgents": [...],
  "navigation": {...},
  "dashboards": [...],
  "statistics": {
    "totalModules": 7,
    "totalEntities": 28,
    "totalApis": 49,
    ...
  }
}
```

### Blueprint Summary

Quick reference of blueprint structure.

```json
{
  "blueprintId": "blueprint-...",
  "id": "app-crm",
  "name": "CRM",
  "namespace": "crm",
  "version": "1.0.0",
  "modules": 7,
  "entities": 28,
  "apis": 49,
  "workflows": 7,
  "automations": 21,
  "aiAgents": 1,
  "status": "compiled"
}
```

### Navigation Contract

Merged navigation structure from all modules.

```json
{
  "version": "1.0.0",
  "applicationId": "app-crm",
  "navigation": {
    "main": [...],
    "admin": [...],
    "dashboards": [...]
  }
}
```

### Dashboard Contract

All dashboards aggregated from modules.

```json
{
  "version": "1.0.0",
  "applicationId": "app-crm",
  "dashboards": [
    {
      "id": "dashboard-sales",
      "name": "Sales Dashboard",
      "module": "crm",
      ...
    },
    ...
  ]
}
```

### API Surface Summary

API endpoint summary with sample endpoints.

```json
{
  "version": "1.0.0",
  "applicationId": "app-crm",
  "totalEndpoints": 49,
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/v1/crm/customers",
      "operation": "list",
      "module": "crm"
    },
    ...
  ]
}
```

## CLI Usage

### Compile Application

```bash
node tools/genesis/genesis.mjs compile application CRM
```

**Output:**
- Application Manifest generated to `out/generated/applications/crm/`
- Blueprint summary
- Navigation structure
- Dashboard definitions
- API surface summary
- Text summary with statistics

### Example Output

```
≡ƒÜÇ Genesis Application Compiler v1 - Compiling 'CRM'

Stage 1: Module Discovery
  ✓ Discovered 7 modules

Stage 2: Load Module Metadata
  ✓ Loaded metadata for 7 modules

Stage 3: Dependency Validation
  ✓ All dependencies resolved

Stage 4: Conflict Resolution
  ✓ Conflicts resolved

Stage 5: Blueprint Assembly
  ✓ Blueprint assembled

Stage 6: Blueprint Validation
  ✓ Blueprint validated

Stage 7: Generate Application Manifest
  ✓ Manifest generated

Stage 8: Generate Application Artifacts
  ✓ Artifacts generated

≡ƒôè APPLICATION COMPILATION COMPLETED

  Application: CRM
  Namespace: crm
  Version: 1.0.0
  Modules: 7
  Entities: 28
  APIs: 49
  Workflows: 7
  Automations: 21
  AI Agents: 1

GENERATED ARTIFACTS:
  • crm.application.json - Application Manifest
  • crm.blueprint.json - Application Blueprint
  • crm.navigation.json - Navigation Contract
  • crm.dashboards.json - Dashboard Contract
  • crm.api-surface.json - API Surface Summary
```

## Runtime Integration

### Application Bootstrap

1. Runtime loads ApplicationManifest
2. Registers all modules
3. Initializes all entities
4. Loads all APIs into API Gateway
5. Registers all workflows
6. Registers all automations
7. Registers all AI agents
8. Builds navigation structure
9. Loads theme configuration
10. Applies application settings

### Module Registration

Each module in the application is registered with:

- Module name and namespace
- Module version
- Entity definitions
- API endpoints
- Workflow definitions
- Automation definitions
- AI agent definitions
- Dashboard definitions
- Navigation structure

### Navigation Structure

Application navigation is merged from all modules:

```json
{
  "main": [
    {
      "label": "CRM",
      "icon": "contacts",
      "items": [
        {
          "label": "Customers",
          "route": "/crm/customers",
          "module": "crm"
        },
        ...
      ]
    },
    ...
  ]
}
```

## Validation Rules

### Blueprint Validation
- Application ID required
- Application name required
- Application namespace required
- At least one module required
- All module validations pass
- All permission validations pass
- Theme color validations pass
- Setting type validations pass

### Module Validation
- Module name required
- Module namespace required
- No circular dependencies
- All required dependencies available
- All entities valid
- All APIs valid

### Manifest Validation
- Application info required
- At least one module
- Statistics match content counts
- All registered modules accounted for

## Error Handling

### Discovery Errors
- Modules directory not found
- Module metadata file missing
- Corrupted JSON files

### Dependency Errors
- Required module not found
- Version mismatch
- Circular dependencies

### Conflict Errors
- Namespace collisions
- Duplicate entity names
- Incompatible permission definitions

### Validation Errors
- Missing required fields
- Invalid data types
- Invalid color formats
- Dependency resolution failures

## Performance Characteristics

- **Module Discovery**: O(1) file system scan
- **Metadata Loading**: O(n) per module
- **Dependency Validation**: O(n²) worst case
- **Blueprint Assembly**: O(n*m) where n=modules, m=artifacts per module
- **Manifest Generation**: O(n) linear aggregation
- **Total Compilation**: ~100-500ms for typical 7-module application

## Files

- `tools/genesis/compiler/ApplicationBlueprintContract.mjs` - Contract definitions (~550 lines)
- `tools/genesis/compiler/ApplicationCompiler.mjs` - Compiler implementation (~450 lines)
- `tools/genesis/commands/compile.mjs` - CLI support (updated)
- `tools/genesis/tests/suites/ApplicationCompilerTests.mjs` - Test suite (20 tests)
- `docs/architecture/0012-application-compiler.md` - This documentation

## Testing

The Application Compiler test suite (20 tests) covers:

1. Blueprint initialization
2. Blueprint validation
3. Module validation
4. Permission validation
5. Theme color validation
6. Setting type validation
7. Module aggregation
8. API aggregation
9. Status transitions
10. Manifest initialization
11. Manifest validation
12. Compiler initialization
13. Module discovery
14. Blueprint summary
15. Manifest serialization
16. Compiler results
17-20. Additional edge cases

All tests pass with zero failures.

## Success Criteria ✅

- ✅ Application Compiler exists
- ✅ Discovers compiled modules from metadata
- ✅ Assembles ApplicationBlueprint
- ✅ Generates Application Manifest
- ✅ Creates deployment artifacts
- ✅ Validates all components
- ✅ CLI works (`compile application CRM`)
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
