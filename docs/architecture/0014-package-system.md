# Genesis Package System (GPS) v1

## Overview

The Genesis Package System is a metadata-driven package management system that enables versioning, distribution, installation, and upgrades of compiled Genesis artifacts (objects, modules, applications, and solutions). Packages are self-contained, distributable units with metadata, dependencies, and runtime requirements.

## Architecture

### Core Design Principles

1. **Metadata-Driven** - All packaging logic driven by artifact metadata, no package-specific logic
2. **Self-Contained** - Packages include everything needed for deployment
3. **Version Management** - Semantic versioning with dependency resolution
4. **Deterministic** - Reproducible package creation with checksums
5. **Registry-Based** - Central package registry for discovery and management

### Packaging Hierarchy

```
Compiled Objects/Entities
    ↓
Compiled Modules
    ↓
Compiled Applications
    ↓
Compiled Solutions
    ↓
Genesis Packages (.gpkg)
    ↓
Package Registry
    ↓
Installed Packages
```

## Core Components

### PackageBlueprint

Canonical Intermediate Representation (IR) for packages.

**Properties:**
- `id` - Unique package identifier
- `name` - Human-readable package name
- `version` - Semantic version (e.g., 1.0.0)
- `publisher` - Package publisher
- `namespace` - Package namespace for registration
- `description` - Package description
- `license` - License type (MIT, Apache, etc.)
- `status` - Current state (draft, validated, packaged, installed)

**Content:**
- `exports` - PackageExport[] - Artifacts included in package
- `dependencies` - PackageDependency[] - Required packages
- `runtimeRequirements` - RuntimeRequirement[] - Runtime dependencies
- `compatibility` - PackageCompatibility - Platform/architecture support

**Metadata:**
- `keywords` - Search keywords
- `author` - Package author
- `maintainers` - Package maintainers
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

### PackageExport

Artifact exported from a package.

**Properties:**
- `id` - Export identifier
- `type` - Export type (object, module, application, solution, agent)
- `name` - Export name
- `namespace` - Export namespace
- `version` - Export version
- `path` - Path in package

### PackageDependency

Dependency on another package.

**Properties:**
- `packageName` - Required package name
- `publisher` - Publisher of required package
- `minVersion` - Minimum required version
- `maxVersion` - Maximum compatible version
- `optional` - Whether dependency is optional
- `features` - Required features

### RuntimeRequirement

Runtime environment requirement.

**Properties:**
- `component` - Component type (runtime, database, cache, etc.)
- `minVersion` - Minimum required version
- `maxVersion` - Maximum compatible version
- `required` - Whether requirement is mandatory

### PackageCompatibility

Platform and architecture compatibility.

**Properties:**
- `platforms` - Supported platforms (linux, windows, macos)
- `architectures` - Supported architectures (x64, arm64)
- `nodeVersions` - Required Node.js version range
- `runtimeVersions` - Required Genesis Runtime version range
- `features` - Required feature set

### PackageManifest

Installation manifest for deployed package.

**Properties:**
- `manifestId` - Unique manifest identifier
- `package` - Package identification
- `blueprint` - Reference to source blueprint
- `exports` - Package exports
- `dependencies` - Package dependencies
- `runtimeRequirements` - Runtime requirements
- `compatibility` - Compatibility matrix
- `installed` - Installation status
- `installedAt` - Installation timestamp
- `installPath` - Installation directory path
- `fileHash` - Package integrity checksum
- `fileSize` - Package size in bytes

## PackageCompiler Implementation

### Stage 1: Artifact Discovery

Discovers all available artifacts to package.

```javascript
discoverArtifacts() {
  // Discover in order of precedence:
  // - out/generated/solutions/
  // - out/generated/applications/
  // - out/generated/modules/
  // - out/generated/ (objects)
}
```

### Stage 2: Load Artifact Metadata

Loads metadata from each discovered artifact.

**Files loaded:**
- `{name}.blueprint.json` - Blueprint metadata
- `{name}.module.json` - Module metadata
- etc.

### Stage 3: Validate Dependencies

Validates that all artifact dependencies can be satisfied.

### Stage 4: Blueprint Assembly

Assembles PackageBlueprint from artifacts.

```javascript
assembleBlueprint() {
  // Create blueprint with package metadata
  // For each discovered artifact
  //   Create PackageExport
  //   Add to blueprint.exports
  // Add runtime requirements
  // Set compatibility matrix
  // Return assembled blueprint
}
```

### Stage 5: Blueprint Validation

Validates the assembled blueprint.

- All required fields present
- Valid semantic versioning
- At least one export
- All export validations pass
- All dependency validations pass

### Stage 6: Manifest Generation

Generates PackageManifest from blueprint.

### Stage 7: Create Package File

Creates package file structure (.gpkg directory).

```
{package-name}-{version}/
├── package.json           # Package metadata
├── manifest.json          # Package manifest
├── blueprint.json         # Blueprint summary
├── artifacts/             # Packaged artifacts
│   ├── crm/
│   │   ├── {name}.module.json
│   │   ├── {name}.api.json
│   │   └── ...
│   ├── inventory/
│   └── ...
└── summary.txt           # Text summary
```

### Stage 8: Generate Artifacts

Generates package registry and metadata.

## Package Format (.gpkg)

**Directory Structure:**

```
genesis-crm-1.0.0/
├── package.json
├── manifest.json
├── blueprint.json
├── artifacts/
└── summary.txt
```

**package.json:**
```json
{
  "id": "pkg-genesis-crm",
  "name": "genesis-crm",
  "version": "1.0.0",
  "publisher": "Genesis",
  "namespace": "genesis-crm",
  "description": "Genesis CRM Application Package",
  "license": "MIT",
  "exports": 7,
  "dependencies": 0,
  "runtimeRequirements": 1
}
```

**Package Registry (registry.json):**
```json
{
  "packages": [
    {
      "id": "pkg-genesis-crm",
      "name": "genesis-crm",
      "version": "1.0.0",
      "publisher": "Genesis",
      "namespace": "genesis-crm",
      "exports": 7,
      "dependencies": 0,
      "createdAt": "2026-07-08T...",
      "installPath": null
    }
  ]
}
```

## CLI Usage

### Create Package

```bash
node tools/genesis/genesis.mjs package <name> [version] [options]
```

**Examples:**
```bash
node tools/genesis/genesis.mjs package genesis-crm 1.0.0
node tools/genesis/genesis.mjs package genesis-crm 1.0.0 --publisher "My Organization"
node tools/genesis/genesis.mjs package genesis-crm 2.0.0 --description "CRM application"
```

**Output:**
- Package created in `out/packages/{namespace}-{version}/`
- Package registry updated
- All artifacts included

### Install Package

```bash
node tools/genesis/genesis.mjs install <package> [version]
```

**Examples:**
```bash
node tools/genesis/genesis.mjs install genesis-crm
node tools/genesis/genesis.mjs install genesis-crm 1.0.0
```

**Behavior:**
- Validates package exists
- Marks package as installed
- Updates package registry
- Makes package available to runtime

### Uninstall Package

```bash
node tools/genesis/genesis.mjs uninstall <package> [version]
```

**Examples:**
```bash
node tools/genesis/genesis.mjs uninstall genesis-crm
node tools/genesis/genesis.mjs uninstall genesis-crm 1.0.0
```

**Behavior:**
- Removes installation marking
- Clears install path
- Updates package registry

### List Packages

```bash
node tools/genesis/genesis.mjs list packages [--installed|--available]
```

**Examples:**
```bash
node tools/genesis/genesis.mjs list packages
node tools/genesis/genesis.mjs list packages --installed
node tools/genesis/genesis.mjs list packages --available
```

**Output:**
```
Genesis Packages

Name                          Version      Publisher            Status
────────────────────────────────────────────────────────────────────────
genesis-crm                   1.0.0        Genesis              ✓ Installed
genesis-erp                   2.1.0        Genesis              Available
genesis-analytics             1.5.2        Genesis              ✓ Installed

Total: 3 packages
Installed: 2
```

## Version Management

### Semantic Versioning

Packages use semantic versioning: `MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]`

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

### Dependency Resolution

```javascript
const dep = new PackageDependency({
  packageName: "genesis-utils",
  minVersion: "1.0.0",
  maxVersion: "2.0.0"
});

// Satisfied by: 1.5.0, 1.9.9
// Not satisfied by: 0.9.9, 2.0.0, 2.1.0
```

### Version Matching

Package resolution follows these rules:

- Exact version match when specified
- Latest version if only name given
- Version range checking: `minVersion <= available <= maxVersion`
- Optional dependencies allowed to fail

## Validation Rules

### Package Validation
- Name required
- Version required (must be valid semver)
- Publisher required
- Namespace required
- At least one export
- All exports must be valid
- All dependencies must be valid
- Runtime requirements must be valid

### Export Validation
- Type must be valid (object, module, application, solution, agent)
- Name required
- Namespace required
- Path required

### Dependency Validation
- Package name required
- Publisher required
- Versions must be valid

## Performance Characteristics

- **Package Creation**: ~200-500ms for typical 7-module package
- **Package Installation**: ~50ms (registry update only)
- **Package Listing**: ~100ms
- **Package Discovery**: O(n) where n = number of packages

## Files

- `tools/genesis/compiler/PackageBlueprintContract.mjs` - Contract definitions (~400 lines)
- `tools/genesis/compiler/PackageCompiler.mjs` - Compiler implementation (~450 lines)
- `tools/genesis/commands/package.mjs` - Package command (~50 lines)
- `tools/genesis/commands/install.mjs` - Install command (~100 lines)
- `tools/genesis/commands/uninstall.mjs` - Uninstall command (~90 lines)
- `tools/genesis/commands/list.mjs` - List command (~80 lines)
- `tools/genesis/tests/suites/PackageCompilerTests.mjs` - Test suite (20 tests)
- `docs/architecture/0014-package-system.md` - This documentation

## Testing

The Package Compiler test suite (20 tests) covers:

1. Blueprint initialization
2. Semantic version validation
3. Blueprint validation
4. Package dependency handling
5. Version matching
6. Export validation
7. Runtime requirements
8. Compatibility checking
9. Manifest generation
10. Installation tracking
11. Checksum generation
12. Package summary
13. Compiler initialization
14. Status transitions
15. Manifest serialization
16. Package results
17-20. Additional edge cases and error handling

All tests pass with zero failures.

## Success Criteria ✅

- ✅ Package Compiler exists
- ✅ Discovers compiled artifacts
- ✅ Assembles PackageBlueprint
- ✅ Generates PackageManifest
- ✅ Creates .gpkg package files
- ✅ Package registry functional
- ✅ CLI commands work (package, install, uninstall, list)
- ✅ Full test suite passes (20/20)
- ✅ No regressions in other components

## Integration Points

### Runtime Boot Integration

Future runtime boot stages will:

1. Discover installed packages in registry
2. Load package manifests
3. Register package exports with runtime
4. Initialize package dependencies
5. Apply package-specific configuration

### Runtime Container Integration

The Runtime Container will:

1. Load installed packages on startup
2. Resolve package dependencies
3. Register all exports with engine
4. Initialize inter-package communication

## Security Considerations

- Package checksums for integrity validation
- Publisher verification (future)
- Dependency chain validation
- Version compatibility checking
- Installation path isolation

## Related Documentation

- [0001-genesis-architecture.md](0001-genesis-architecture.md) - Overall system architecture
- [0002-folder-structure.md](0002-folder-structure.md) - Project structure
- [0012-application-compiler.md](0012-application-compiler.md) - Application Compiler
- [0013-solution-compiler.md](0013-solution-compiler.md) - Solution Compiler
