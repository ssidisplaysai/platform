/**
 * PackageBlueprintContract - Genesis Package System v1
 *
 * Canonical Intermediate Representation (IR) for Genesis packages.
 * Packages are versioned, distributable artifacts containing:
 * - Compiled objects, modules, applications, or solutions
 * - Package metadata and dependencies
 * - Runtime requirements and compatibility matrix
 * - Package manifest for installation and discovery
 *
 * @module tools/genesis/compiler/PackageBlueprintContract.mjs
 */

import { randomBytes } from "crypto";

/**
 * PackageDependency
 * Dependency on another package
 */
export class PackageDependency {
  constructor(data = {}) {
    this.id = `dep-${randomBytes(4).toString("hex")}`;
    this.packageName = data.packageName || "";
    this.publisher = data.publisher || "";
    this.minVersion = data.minVersion || "1.0.0";
    this.maxVersion = data.maxVersion || "*";
    this.optional = data.optional === true;
    this.features = data.features || [];
  }

  validate() {
    const errors = [];
    if (!this.packageName) errors.push("Package name is required");
    if (!this.publisher) errors.push("Publisher is required");
    return { isValid: errors.length === 0, errors };
  }

  isSatisfied(availableVersion) {
    // Simple version matching (in production, would use semver library)
    if (this.maxVersion === "*") return true;
    return availableVersion >= this.minVersion && availableVersion <= this.maxVersion;
  }
}

/**
 * PackageExport
 * Exported artifact from package
 */
export class PackageExport {
  constructor(data = {}) {
    this.id = `export-${randomBytes(4).toString("hex")}`;
    this.type = data.type || ""; // object, module, application, solution, agent
    this.name = data.name || "";
    this.namespace = data.namespace || "";
    this.version = data.version || "1.0.0";
    this.path = data.path || ""; // Path in package
  }

  validate() {
    const errors = [];
    const validTypes = ["object", "module", "application", "solution", "agent"];
    if (!validTypes.includes(this.type)) {
      errors.push(`Invalid export type: ${this.type}`);
    }
    if (!this.name) errors.push("Export name is required");
    if (!this.namespace) errors.push("Export namespace is required");
    return { isValid: errors.length === 0, errors };
  }
}

/**
 * RuntimeRequirement
 * Runtime environment requirement
 */
export class RuntimeRequirement {
  constructor(data = {}) {
    this.id = `req-${randomBytes(4).toString("hex")}`;
    this.component = data.component || ""; // runtime, database, cache, etc.
    this.minVersion = data.minVersion || "1.0.0";
    this.maxVersion = data.maxVersion || "*";
    this.required = data.required !== false;
  }

  validate() {
    const errors = [];
    if (!this.component) errors.push("Component is required");
    return { isValid: errors.length === 0, errors };
  }
}

/**
 * PackageCompatibility
 * Compatibility matrix for package
 */
export class PackageCompatibility {
  constructor(data = {}) {
    this.id = `compat-${randomBytes(4).toString("hex")}`;
    this.platforms = data.platforms || ["linux", "windows", "macos"];
    this.architectures = data.architectures || ["x64", "arm64"];
    this.nodeVersions = data.nodeVersions || ">=18.0.0";
    this.runtimeVersions = data.runtimeVersions || ">=1.0.0";
    this.features = data.features || [];
  }

  validate() {
    return { isValid: true, errors: [] };
  }

  isCompatible(platform, arch, nodeVersion) {
    // Simplified compatibility check
    return this.platforms.includes(platform) && this.architectures.includes(arch);
  }
}

/**
 * PackageBlueprint
 * Canonical Intermediate Representation for packages
 */
export class PackageBlueprint {
  constructor(data = {}) {
    this.blueprintId = `blueprint-${Date.now()}-${randomBytes(4).toString("hex")}`;
    this.id = `pkg-${data.name?.toLowerCase() || 'package'}`;
    this.name = data.name || "";
    this.version = data.version || "1.0.0";
    this.publisher = data.publisher || "Genesis";
    this.namespace = data.namespace || data.name?.toLowerCase() || "";
    this.description = data.description || "";
    this.license = data.license || "MIT";
    this.homepage = data.homepage || "";
    this.repository = data.repository || "";
    this.status = "draft"; // draft, validated, packaged, installed

    // Content
    this.exports = [];
    this.dependencies = [];
    this.runtimeRequirements = [];
    this.compatibility = new PackageCompatibility(data.compatibility);

    // Metadata
    this.keywords = data.keywords || [];
    this.author = data.author || data.publisher;
    this.maintainers = data.maintainers || [];
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.metadata = data.metadata || {};
  }

  /**
   * Validate the blueprint
   */
  validate() {
    const errors = [];
    const warnings = [];

    if (!this.name) errors.push("Package name is required");
    if (!this.version) errors.push("Package version is required");
    if (!this.publisher) errors.push("Publisher is required");
    if (!this.namespace) errors.push("Package namespace is required");

    // Validate semantic versioning
    if (!this.isValidVersion(this.version)) {
      errors.push(`Invalid version format: ${this.version}`);
    }

    if (this.exports.length === 0) {
      warnings.push("Package has no exports");
    }

    for (const exp of this.exports) {
      const expValidation = exp.validate();
      if (!expValidation.isValid) {
        errors.push(...expValidation.errors);
      }
    }

    for (const dep of this.dependencies) {
      const depValidation = dep.validate();
      if (!depValidation.isValid) {
        errors.push(...depValidation.errors);
      }
    }

    for (const req of this.runtimeRequirements) {
      const reqValidation = req.validate();
      if (!reqValidation.isValid) {
        errors.push(...reqValidation.errors);
      }
    }

    const compatValidation = this.compatibility.validate();
    if (!compatValidation.isValid) {
      errors.push(...compatValidation.errors);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if version string is valid semantic version
   */
  isValidVersion(version) {
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?(\+[a-zA-Z0-9]+)?$/;
    return semverRegex.test(version);
  }

  /**
   * Mark as validated
   */
  markValidated() {
    if (this.status === "draft") {
      this.status = "validated";
    }
  }

  /**
   * Mark as packaged
   */
  markPackaged() {
    if (this.status === "validated") {
      this.status = "packaged";
    }
  }

  /**
   * Mark as installed
   */
  markInstalled() {
    this.status = "installed";
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Get package summary
   */
  getSummary() {
    return {
      blueprintId: this.blueprintId,
      id: this.id,
      name: this.name,
      version: this.version,
      publisher: this.publisher,
      namespace: this.namespace,
      status: this.status,
      exportsCount: this.exports.length,
      dependenciesCount: this.dependencies.length,
      runtimeRequirementsCount: this.runtimeRequirements.length,
      createdAt: this.createdAt
    };
  }

  /**
   * Get package checksum (for integrity validation)
   */
  getChecksum() {
    const content = JSON.stringify({
      name: this.name,
      version: this.version,
      exports: this.exports.map(e => e.name),
      dependencies: this.dependencies.map(d => d.packageName)
    });
    // Simple checksum (in production would use crypto.createHash)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * PackageManifest
 * Package manifest for installation and discovery
 */
export class PackageManifest {
  constructor(data = {}) {
    this.manifestId = `manifest-${Date.now()}-${randomBytes(4).toString("hex")}`;
    this.version = "1.0.0";
    this.generatedAt = new Date().toISOString();
    this.status = "generated";

    // Package identification
    this.package = data.package || {
      id: "",
      name: "",
      version: "",
      publisher: ""
    };

    // Blueprint reference
    this.blueprint = data.blueprint || null;

    // Package content
    this.exports = data.exports || [];
    this.dependencies = data.dependencies || [];
    this.runtimeRequirements = data.runtimeRequirements || [];
    this.compatibility = data.compatibility || {};

    // Installation info
    this.installed = false;
    this.installedAt = null;
    this.installPath = data.installPath || "";

    // Metadata
    this.fileHash = data.fileHash || "";
    this.fileSize = data.fileSize || 0;
    this.metadata = data.metadata || {};
  }

  /**
   * Validate the manifest
   */
  validate() {
    const errors = [];

    if (!this.package?.name) errors.push("Package name is required");
    if (!this.package?.version) errors.push("Package version is required");
    if (this.exports.length === 0) errors.push("Package must have at least one export");

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Mark as installed
   */
  markInstalled(installPath) {
    this.installed = true;
    this.installedAt = new Date().toISOString();
    this.installPath = installPath;
    this.status = "installed";
  }

  /**
   * Mark as uninstalled
   */
  markUninstalled() {
    this.installed = false;
    this.installedAt = null;
    this.installPath = "";
    this.status = "uninstalled";
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      manifestId: this.manifestId,
      version: this.version,
      generatedAt: this.generatedAt,
      status: this.status,
      package: this.package,
      exportsCount: this.exports.length,
      dependenciesCount: this.dependencies.length,
      installed: this.installed,
      installedAt: this.installedAt,
      installPath: this.installPath,
      fileHash: this.fileHash,
      fileSize: this.fileSize
    };
  }
}
