/**
 * ModuleRenderer - Phase 11
 *
 * Generates module manifests and module-level registration documents.
 *
 * Consumes: EnterpriseObjectBlueprint.module section
 * Produces: JSON module manifest
 *
 * @module tools/genesis/compiler/renderers/ModuleRenderer
 */

/**
 * Generate module manifest
 *
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {string} JSON module manifest
 */
export function generateModule(blueprint) {
  if (!blueprint || !blueprint.metadata || !blueprint.module) {
    throw new Error('Blueprint and module section required for module manifest generation');
  }

  const entityName = blueprint.metadata.entity;
  const module = blueprint.module;

  const manifest = {
    $schema: 'https://genesis.internal/schema/module-manifest.json',
    version: '1.0.0',
    generated: {
      at: new Date().toISOString(),
      by: 'Genesis Object Compiler v1',
      phase: 'Phase 11: Module-Aware Architecture',
    },
    module: {
      name: module.module.name,
      namespace: module.module.namespace,
      description: module.module.description,
      tier: module.module.tier,
      domain: module.module.domain,
    },
    entity: {
      name: entityName,
      path: module.ownership.ownershipPath,
      registryKey: module.ownership.ownershipRegistryKey,
      version: module.ownership.version,
    },
    boundaries: {
      public: {
        fields: module.boundaries.publicFields,
        relationships: module.boundaries.publicRelationships,
      },
      internal: {
        fields: module.boundaries.internalFields,
        relationships: module.boundaries.internalRelationships,
      },
      capabilities: module.boundaries.capabilities,
    },
    integrations: {
      count: module.integration.count,
      modules: module.integration.integrations,
    },
    registry: {
      modulePath: module.registry.registryPath,
      entityPath: module.registry.entityPath,
      discoverable: module.registry.discoverable,
      indexed: module.registry.indexed,
    },
    architecture: {
      isCore: module.architecture.isCore,
      isExtension: module.architecture.isExtension,
      isMono: module.architecture.isMono,
      supportsPolymorphism: module.architecture.supportsPolymorphism,
    },
    manifest: {
      completeness: calculateManifestCompleteness(blueprint, module),
      validationStatus: 'pending',
      deploymentReady: calculateDeploymentReady(module),
    },
  };

  return JSON.stringify(manifest, null, 2);
}

/**
 * Calculate manifest completeness score
 */
function calculateManifestCompleteness(blueprint, module) {
  let score = 0;
  const maxScore = 100;

  // Module information (15 points)
  if (module.module.name && module.module.namespace && module.module.description) score += 15;

  // Ownership information (15 points)
  if (module.ownership.entityName && module.ownership.moduleKey && module.ownership.ownershipPath) score += 15;

  // Boundaries defined (20 points)
  const publicFields = module.boundaries.publicFields?.length || 0;
  const publicRels = module.boundaries.publicRelationships?.length || 0;
  if (publicFields > 0 || publicRels > 0) score += 20;

  // Internal fields/relationships (15 points)
  const internalFields = module.boundaries.internalFields?.length || 0;
  const internalRels = module.boundaries.internalRelationships?.length || 0;
  if (internalFields > 0 || internalRels > 0) score += 15;

  // Capabilities documented (10 points)
  if (module.boundaries.capabilities) score += 10;

  // Integrations documented (5 points)
  if (module.integration.integrations?.length > 0) score += 5;

  // Registry information (5 points)
  if (module.registry.registryPath && module.registry.entityPath) score += 5;

  return {
    score: Math.min(score, maxScore),
    maxScore: maxScore,
    percentage: Math.min(score, maxScore),
    complete: Math.min(score, maxScore) >= 80,
  };
}

/**
 * Calculate deployment readiness
 */
function calculateDeploymentReady(module) {
  const checks = {
    hasModuleName: !!module.module.name,
    hasNamespace: !!module.module.namespace,
    hasDescription: !!module.module.description,
    hasBoundaries: !!module.boundaries,
    hasRegistry: !!module.registry,
    isRegistered: !!module.registry.registryPath,
  };

  const passed = Object.values(checks).filter(v => v).length;
  const total = Object.keys(checks).length;

  return {
    ready: passed === total,
    checks: checks,
    passed: passed,
    total: total,
    percentage: Math.round((passed / total) * 100),
  };
}
