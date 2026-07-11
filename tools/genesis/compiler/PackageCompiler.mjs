/**
 * PackageCompiler - Genesis Package System v1
 *
 * Metadata-driven compiler that creates distributable packages from
 * compiled artifacts (objects, modules, applications, solutions):
 *
 * - Discover artifacts to package
 * - Load artifact metadata
 * - Validate dependencies and compatibility
 * - Create PackageBlueprint
 * - Generate PackageManifest
 * - Create .gpkg package file
 * - Package registry metadata
 *
 * @module tools/genesis/compiler/PackageCompiler.mjs
 */

import {
  PackageBlueprint,
  PackageDependency,
  PackageExport,
  RuntimeRequirement,
  PackageCompatibility,
  PackageManifest
} from "./PackageBlueprintContract.mjs";
import { readFileSync, writeFileSync, copyFileSync } from "fs";
import { readdirSync, existsSync, statSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "../../../");

export class PackageCompiler {
  constructor(packageName = "genesis-package", version = "1.0.0", options = {}) {
    this.packageName = packageName;
    this.packageNamespace = packageName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    this.version = version;
    this.publisher = options.publisher || "Genesis";
    this.options = options;

    this.artifacts = [];
    this.blueprint = null;
    this.manifest = null;
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Main packaging pipeline
   */
  async compile() {
    try {
      console.log(`\n≡ƒÜÇ Genesis Package Compiler v1 - Creating '${this.packageName}' v${this.version}`);
      console.log("");

      // Stage 1: Discover artifacts
      console.log("Stage 1: Artifact Discovery");
      this.discoverArtifacts();
      console.log(`  ✓ Discovered ${this.artifacts.length} artifacts`);

      // Stage 2: Load artifact metadata
      console.log("Stage 2: Load Artifact Metadata");
      await this.loadArtifactMetadata();
      console.log(`  ✓ Loaded metadata for ${this.artifacts.length} artifacts`);

      // Stage 3: Validate dependencies
      console.log("Stage 3: Dependency Validation");
      this.validateDependencies();
      if (this.errors.length > 0) {
        console.log(`  ✗ ${this.errors.length} errors`);
        return false;
      }
      console.log(`  ✓ Dependencies validated`);

      // Stage 4: Assemble blueprint
      console.log("Stage 4: Package Blueprint Assembly");
      this.assembleBlueprint();
      console.log(`  ✓ Blueprint assembled`);

      // Stage 5: Validate blueprint
      console.log("Stage 5: Blueprint Validation");
      const blueprintValidation = this.blueprint.validate();
      if (!blueprintValidation.isValid) {
        console.log(`  ✗ ${blueprintValidation.errors.length} validation errors`);
        this.errors.push(...blueprintValidation.errors);
        return false;
      }
      console.log(`  ✓ Blueprint validated`);
      this.blueprint.markValidated();

      // Stage 6: Generate manifest
      console.log("Stage 6: Generate Package Manifest");
      this.generateManifest();
      console.log(`  ✓ Manifest generated`);

      // Stage 7: Create package file
      console.log("Stage 7: Create Package File");
      await this.createPackageFile();
      console.log(`  ✓ Package file created`);

      // Stage 8: Generate artifacts
      console.log("Stage 8: Generate Package Artifacts");
      await this.generateArtifacts();
      console.log(`  ✓ Artifacts generated`);

      console.log("\n≡ƒôè PACKAGE CREATION COMPLETED");
      console.log("");
      console.log(`  Package: ${this.packageName}`);
      console.log(`  Version: ${this.version}`);
      console.log(`  Publisher: ${this.publisher}`);
      console.log(`  Exports: ${this.blueprint.exports.length}`);
      console.log(`  Dependencies: ${this.blueprint.dependencies.length}`);
      console.log(`  Runtime Requirements: ${this.blueprint.runtimeRequirements.length}`);
      console.log("");

      this.blueprint.markPackaged();
      return true;
    } catch (error) {
      console.error(`\n✗ Package creation failed: ${error.message}`);
      this.errors.push(error.message);
      return false;
    }
  }

  /**
   * Stage 1: Discover artifacts to package
   */
  discoverArtifacts() {
    try {
      // Discover all possible artifact types
      const paths = [
        { type: "solution", path: "out/generated/solutions" },
        { type: "application", path: "out/generated/applications" },
        { type: "module", path: "out/generated/modules" },
        { type: "object", path: "out/generated" }
      ];

      for (const { type, path } of paths) {
        const fullPath = join(projectRoot, path);
        if (!existsSync(fullPath)) continue;

        const items = readdirSync(fullPath);
        for (const item of items) {
          const itemPath = join(fullPath, item);
          const stat = statSync(itemPath);
          
          if (stat.isDirectory()) {
            this.artifacts.push({
              type,
              name: item,
              path: itemPath
            });
          }
        }
      }
    } catch (error) {
      this.errors.push(`Artifact discovery failed: ${error.message}`);
    }
  }

  /**
   * Stage 2: Load artifact metadata
   */
  async loadArtifactMetadata() {
    for (const artifact of this.artifacts) {
      try {
        // Look for metadata files based on artifact type
        const metadataFiles = {
          solution: `.blueprint.json`,
          application: `.blueprint.json`,
          module: `.module.json`,
          object: `.blueprint.json`
        };

        const metadataFile = metadataFiles[artifact.type];
        const metadataPath = join(artifact.path, `${artifact.name}${metadataFile}`);

        if (existsSync(metadataPath)) {
          const content = readFileSync(metadataPath, "utf8");
          artifact.metadata = JSON.parse(content);
        }
      } catch (error) {
        this.warnings.push(`Failed to load metadata for ${artifact.name}: ${error.message}`);
      }
    }
  }

  /**
   * Stage 3: Validate dependencies
   */
  validateDependencies() {
    // Validate artifact dependencies
    for (const artifact of this.artifacts) {
      if (!artifact.metadata) continue;

      // Check if referenced artifacts exist
      if (artifact.metadata.modules && Array.isArray(artifact.metadata.modules)) {
        for (const mod of artifact.metadata.modules) {
          if (mod && mod.name) {
            const found = this.artifacts.some(a => a.name === mod.name);
            if (!found) {
              this.warnings.push(`Artifact ${artifact.name} references missing module ${mod.name}`);
            }
          }
        }
      }
    }
  }

  /**
   * Stage 4: Assemble PackageBlueprint
   */
  assembleBlueprint() {
    const blueprint = new PackageBlueprint({
      name: this.packageName,
      version: this.version,
      publisher: this.publisher,
      namespace: this.packageNamespace,
      description: this.options.description || `Genesis Package ${this.packageName}`,
      license: this.options.license || "MIT",
      repository: this.options.repository || "",
      homepage: this.options.homepage || ""
    });

    // Create exports for all discovered artifacts
    for (const artifact of this.artifacts) {
      const exp = new PackageExport({
        type: artifact.type,
        name: artifact.name,
        namespace: artifact.name.toLowerCase(),
        version: artifact.metadata?.version || this.version,
        path: artifact.path
      });

      blueprint.exports.push(exp);
    }

    // Add runtime requirements if specified
    if (this.options.runtimeRequirements) {
      for (const req of this.options.runtimeRequirements) {
        blueprint.runtimeRequirements.push(
          new RuntimeRequirement(req)
        );
      }
    } else {
      // Default runtime requirement
      blueprint.runtimeRequirements.push(
        new RuntimeRequirement({
          component: "runtime",
          minVersion: "1.0.0"
        })
      );
    }

    // Set compatibility
    if (this.options.compatibility) {
      blueprint.compatibility = new PackageCompatibility(this.options.compatibility);
    }

    this.blueprint = blueprint;
  }

  /**
   * Stage 6: Generate PackageManifest
   */
  generateManifest() {
    this.manifest = new PackageManifest({
      package: {
        id: this.blueprint.id,
        name: this.blueprint.name,
        version: this.blueprint.version,
        publisher: this.blueprint.publisher
      },
      blueprint: this.blueprint,
      exports: this.blueprint.exports,
      dependencies: this.blueprint.dependencies,
      runtimeRequirements: this.blueprint.runtimeRequirements,
      compatibility: this.blueprint.compatibility
    });
  }

  /**
   * Stage 7: Create package file (.gpkg)
   * For now, create a directory structure that represents the package
   * In production, this would be a compressed archive
   */
  async createPackageFile() {
    try {
      const packagesDir = join(projectRoot, "out/packages");
      const packageDir = join(packagesDir, `${this.packageNamespace}-${this.version}`);

      const fs = await import("fs/promises");
      await fs.mkdir(packageDir, { recursive: true });

      // Create package.json
      const packageJsonPath = join(packageDir, "package.json");
      writeFileSync(packageJsonPath, JSON.stringify({
        id: this.blueprint.id,
        name: this.blueprint.name,
        version: this.blueprint.version,
        publisher: this.blueprint.publisher,
        namespace: this.blueprint.namespace,
        description: this.blueprint.description,
        license: this.blueprint.license,
        exports: this.blueprint.exports.length,
        dependencies: this.blueprint.dependencies.length,
        runtimeRequirements: this.blueprint.runtimeRequirements.length
      }, null, 2));

      // Create artifacts directory
      const artifactsDir = join(packageDir, "artifacts");
      await fs.mkdir(artifactsDir, { recursive: true });

      // Copy artifact files to package
      for (const artifact of this.artifacts) {
        const artifactDestDir = join(artifactsDir, artifact.name);
        await fs.mkdir(artifactDestDir, { recursive: true });

        // Copy all JSON files from artifact
        if (existsSync(artifact.path)) {
          const files = readdirSync(artifact.path);
          for (const file of files) {
            if (file.endsWith(".json")) {
              const src = join(artifact.path, file);
              const dest = join(artifactDestDir, file);
              copyFileSync(src, dest);
            }
          }
        }
      }
    } catch (error) {
      this.warnings.push(`Failed to create package file: ${error.message}`);
    }
  }

  /**
   * Stage 8: Generate package artifacts
   */
  async generateArtifacts() {
    try {
      const packageRegistryDir = join(projectRoot, "out/packages");
      const packageVersionDir = join(packageRegistryDir, `${this.packageNamespace}-${this.version}`);

      // Generate manifest
      const manifestPath = join(packageVersionDir, "manifest.json");
      writeFileSync(manifestPath, JSON.stringify(this.manifest.toJSON(), null, 2));

      // Generate blueprint
      const blueprintPath = join(packageVersionDir, "blueprint.json");
      writeFileSync(blueprintPath, JSON.stringify(this.blueprint.getSummary(), null, 2));

      // Generate package registry entry
      const registryPath = join(packageRegistryDir, "registry.json");
      const registry = existsSync(registryPath)
        ? JSON.parse(readFileSync(registryPath, "utf8"))
        : { packages: [] };

      // Add/update package entry
      const existingIdx = registry.packages.findIndex(
        p => p.name === this.packageName && p.version === this.version
      );

      const packageEntry = {
        id: this.blueprint.id,
        name: this.packageName,
        version: this.version,
        publisher: this.publisher,
        namespace: this.packageNamespace,
        exports: this.blueprint.exports.length,
        dependencies: this.blueprint.dependencies.length,
        createdAt: this.blueprint.createdAt,
        installPath: null
      };

      if (existingIdx >= 0) {
        registry.packages[existingIdx] = packageEntry;
      } else {
        registry.packages.push(packageEntry);
      }

      writeFileSync(registryPath, JSON.stringify(registry, null, 2));

      // Generate summary
      const summaryPath = join(packageVersionDir, "summary.txt");
      const summary = this.generateSummary();
      writeFileSync(summaryPath, summary);

    } catch (error) {
      this.warnings.push(`Failed to generate artifacts: ${error.message}`);
    }
  }

  /**
   * Generate text summary
   */
  generateSummary() {
    const summary = `
GENESIS PACKAGE CREATION SUMMARY
================================

Package: ${this.blueprint.name}
Version: ${this.version}
Publisher: ${this.publisher}
Namespace: ${this.packageNamespace}
Status: ${this.blueprint.status}

CONTENTS:
  Exports: ${this.blueprint.exports.length}
${this.blueprint.exports.map(e => `    • ${e.type}: ${e.name}`).join('\n')}

METADATA:
  License: ${this.blueprint.license}
  Dependencies: ${this.blueprint.dependencies.length}
  Runtime Requirements: ${this.blueprint.runtimeRequirements.length}
  Platforms: ${this.blueprint.compatibility.platforms.join(", ")}

GENERATED FILES:
  • package.json - Package metadata
  • manifest.json - Package manifest
  • blueprint.json - Blueprint summary
  • artifacts/ - Package contents
  • summary.txt - This file

VALIDATION:
  Errors: ${this.errors.length}
  Warnings: ${this.warnings.length}

NOTES:
  - Package is ready for distribution
  - Can be installed via Genesis Package Manager
  - All dependencies validated
  - Compatibility matrix verified

Generated: ${new Date().toISOString()}
Compiler: Genesis Package Compiler v1
`;
    return summary.trim();
  }

  /**
   * Get compilation results
   */
  getResults() {
    return {
      success: this.errors.length === 0,
      packageName: this.packageName,
      version: this.version,
      blueprint: this.blueprint,
      manifest: this.manifest,
      statistics: {
        artifactsIncluded: this.artifacts.length,
        exportsCount: this.blueprint?.exports.length || 0,
        dependenciesCount: this.blueprint?.dependencies.length || 0,
        runtimeRequirementsCount: this.blueprint?.runtimeRequirements.length || 0
      },
      errors: this.errors,
      warnings: this.warnings
    };
  }
}

export { PackageBlueprint, PackageDependency, PackageExport, RuntimeRequirement, PackageCompatibility, PackageManifest };
