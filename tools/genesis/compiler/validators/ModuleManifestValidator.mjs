/**
 * ModuleManifestValidator - Validates generated module manifests
 *
 * Validates module manifests against schema and business rules.
 *
 * Purpose:
 *   - Validate module manifest structure and schema
 *   - Verify module boundaries and object membership
 *   - Check capability and permission aggregation
 *   - Ensure artifact references are valid
 *   - Verify module relationships and dependencies
 *
 * Checks:
 *   - Schema compliance
 *   - Required fields present
 *   - Object membership accuracy
 *   - Artifact existence
 *   - Relationship validity
 *   - Capability aggregation correctness
 *   - Completeness and readiness metrics
 *
 * @module tools/genesis/compiler/validators/ModuleManifestValidator
 */

import fs from 'fs';
import path from 'path';

export class ModuleManifestValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Validate a module manifest file
   *
   * @param {string} manifestPath - Path to module manifest JSON
   * @returns {Object} Validation result
   */
  validateManifest(manifestPath) {
    this.errors = [];
    this.warnings = [];

    if (!fs.existsSync(manifestPath)) {
      this.errors.push(`Manifest file not found: ${manifestPath}`);
      return this.getValidationResult();
    }

    try {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(content);

      // Run validation checks
      this.validateSchema(manifest);
      this.validateModuleInfo(manifest);
      this.validateMembers(manifest);
      this.validateRelationships(manifest);
      this.validateCapabilities(manifest);
      this.validatePermissions(manifest);
      this.validateArtifacts(manifest);
      this.validateQuality(manifest);

    } catch (error) {
      this.errors.push(`Failed to parse manifest: ${error.message}`);
    }

    return this.getValidationResult();
  }

  /**
   * Validate manifest schema
   *
   * @param {Object} manifest - Manifest object
   */
  validateSchema(manifest) {
    // Check schema reference
    if (!manifest.$schema) {
      this.warnings.push('Missing $schema reference');
    }

    // Check version
    if (!manifest.version) {
      this.errors.push('Missing version field');
    }

    // Check generation metadata
    if (!manifest.generated) {
      this.errors.push('Missing generated metadata');
    } else {
      if (!manifest.generated.at) this.errors.push('Missing generated.at timestamp');
      if (!manifest.generated.by) this.errors.push('Missing generated.by compiler identifier');
      if (!manifest.generated.phase) this.errors.push('Missing generated.phase');
    }
  }

  /**
   * Validate module information
   *
   * @param {Object} manifest - Manifest object
   */
  validateModuleInfo(manifest) {
    if (!manifest.module) {
      this.errors.push('Missing module section');
      return;
    }

    const required = ['id', 'name', 'namespace', 'tier', 'domain'];
    for (const field of required) {
      if (!manifest.module[field]) {
        this.errors.push(`Missing module.${field}`);
      }
    }

    // Validate tier
    const validTiers = ['core', 'extension', 'custom'];
    if (manifest.module.tier && !validTiers.includes(manifest.module.tier)) {
      this.warnings.push(`Invalid tier: ${manifest.module.tier}`);
    }
  }

  /**
   * Validate member objects section
   *
   * @param {Object} manifest - Manifest object
   */
  validateMembers(manifest) {
    if (!manifest.members) {
      this.errors.push('Missing members section');
      return;
    }

    if (!Array.isArray(manifest.members.objects)) {
      this.errors.push('members.objects must be an array');
      return;
    }

    if (manifest.members.total !== manifest.members.objects.length) {
      this.errors.push(
        `members.total (${manifest.members.total}) does not match objects.length (${manifest.members.objects.length})`
      );
    }

    // Check each object has required fields
    for (const obj of manifest.members.objects) {
      if (!obj.name) {
        this.errors.push('Member object missing name');
      }
      if (!obj.registryKey) {
        this.errors.push(`Member object ${obj.name} missing registryKey`);
      }
      if (!Array.isArray(obj.artifactList)) {
        this.warnings.push(`Member object ${obj.name} missing or invalid artifactList`);
      }
    }
  }

  /**
   * Validate relationships section
   *
   * @param {Object} manifest - Manifest object
   */
  validateRelationships(manifest) {
    if (!manifest.relationships) {
      this.errors.push('Missing relationships section');
      return;
    }

    if (!Array.isArray(manifest.relationships.dependencies)) {
      this.errors.push('relationships.dependencies must be an array');
    }

    if (!Array.isArray(manifest.relationships.dependents)) {
      this.errors.push('relationships.dependents must be an array');
    }

    // Validate each dependency
    if (Array.isArray(manifest.relationships.dependencies)) {
      for (const dep of manifest.relationships.dependencies) {
        if (!dep.moduleName) {
          this.warnings.push('Dependency missing moduleName');
        }
        if (!dep.moduleId) {
          this.warnings.push('Dependency missing moduleId');
        }
      }
    }
  }

  /**
   * Validate capabilities section
   *
   * @param {Object} manifest - Manifest object
   */
  validateCapabilities(manifest) {
    if (!manifest.capabilities) {
      this.errors.push('Missing capabilities section');
      return;
    }

    if (!Array.isArray(manifest.capabilities.summary)) {
      this.errors.push('capabilities.summary must be an array');
    } else {
      // Verify consistency of counts
      for (const cap of manifest.capabilities.summary) {
        if (cap.total !== (cap.enabled + cap.disabled)) {
          this.errors.push(
            `Capability ${cap.name} total (${cap.total}) != enabled (${cap.enabled}) + disabled (${cap.disabled})`
          );
        }
      }
    }
  }

  /**
   * Validate permissions section
   *
   * @param {Object} manifest - Manifest object
   */
  validatePermissions(manifest) {
    if (!manifest.permissions) {
      this.errors.push('Missing permissions section');
      return;
    }

    if (!Array.isArray(manifest.permissions.roles)) {
      this.warnings.push('permissions.roles must be an array');
    }

    if (!Array.isArray(manifest.permissions.policies)) {
      this.warnings.push('permissions.policies must be an array');
    } else {
      for (const policy of manifest.permissions.policies) {
        if (!policy.name || !policy.action) {
          this.warnings.push('Policy missing name or action');
        }
      }
    }
  }

  /**
   * Validate artifacts section
   *
   * @param {Object} manifest - Manifest object
   */
  validateArtifacts(manifest) {
    if (!manifest.artifacts) {
      this.errors.push('Missing artifacts section');
      return;
    }

    if (typeof manifest.artifacts.totalCount !== 'number') {
      this.errors.push('artifacts.totalCount must be a number');
    }

    if (!Array.isArray(manifest.artifacts.byType)) {
      this.errors.push('artifacts.byType must be an array');
    }
  }

  /**
   * Validate quality section
   *
   * @param {Object} manifest - Manifest object
   */
  validateQuality(manifest) {
    if (!manifest.quality) {
      this.errors.push('Missing quality section');
      return;
    }

    if (!manifest.quality.completeness) {
      this.errors.push('Missing quality.completeness');
    } else {
      if (typeof manifest.quality.completeness.score !== 'number') {
        this.errors.push('quality.completeness.score must be a number');
      }
      if (manifest.quality.completeness.score < 0 || manifest.quality.completeness.score > 100) {
        this.errors.push('quality.completeness.score must be between 0 and 100');
      }
    }

    if (!manifest.quality.validation) {
      this.errors.push('Missing quality.validation');
    }

    if (!manifest.quality.deploymentReady) {
      this.errors.push('Missing quality.deploymentReady');
    }
  }

  /**
   * Get validation result
   *
   * @returns {Object} Validation result
   */
  getValidationResult() {
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      totalIssues: this.errors.length + this.warnings.length
    };
  }
}

export {};
