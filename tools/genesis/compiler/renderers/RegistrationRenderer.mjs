/**
 * RegistrationRenderer - Phase 10
 *
 * Generates runtime registration manifests from blueprint.
 *
 * Consumes: EnterpriseObjectBlueprint.registration section
 * Produces: JSON registration manifest
 *
 * @module tools/genesis/compiler/renderers/RegistrationRenderer
 */

/**
 * Generate runtime registration manifest
 *
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {string} JSON registration manifest
 */
export function generateRegistration(blueprint) {
  if (!blueprint || !blueprint.metadata || !blueprint.registration) {
    throw new Error('Blueprint and registration section required for manifest generation');
  }

  const entityName = blueprint.metadata.entity;
  const registration = blueprint.registration;

  const manifest = {
    $schema: 'https://genesis.internal/schema/registration-manifest.json',
    version: '1.0.0',
    generated: {
      at: new Date().toISOString(),
      by: 'Genesis Object Compiler v1',
      phase: 'Phase 10: Runtime Registration',
    },
    entity: {
      name: {
        singular: registration.manifest.name.singular,
        plural: registration.manifest.name.plural,
        camelCase: registration.manifest.name.camelCase,
        pascalCase: registration.manifest.name.pascalCase,
      },
      namespace: registration.manifest.namespace.logical,
      module: registration.manifest.namespace.module,
      path: registration.manifest.namespace.path,
      description: registration.manifest.name.description,
    },
    version: {
      semantic: registration.manifest.version.semantic,
      compiledAt: registration.manifest.version.compiledAt,
    },
    classification: {
      domain: registration.manifest.classification.domain,
      type: registration.manifest.classification.type,
      tier: registration.manifest.classification.tier,
      tags: registration.manifest.classification.tags,
    },
    structure: {
      fields: registration.manifest.structure.fields,
      relationships: registration.manifest.structure.relationships,
    },
    capabilities: registration.manifest.capabilities,
    lifecycle: {
      states: registration.manifest.lifecycle.states,
      transitions: registration.manifest.lifecycle.transitions,
      initialState: registration.manifest.lifecycle.initialState,
      terminalStates: registration.manifest.lifecycle.terminalStates,
    },
    permissions: registration.manifest.permissions,
    validation: registration.manifest.validation,
    search: registration.manifest.search,
    api: registration.manifest.api,
    artifacts: {
      total: registration.artifacts.total,
      registry: registration.artifacts.artifacts.map(a => ({
        type: a.type,
        name: a.name,
        namespace: a.namespace,
        description: a.description,
        registerable: a.registerable,
        exportable: a.exportable,
      })),
    },
    registryMetadata: registration.metadata,
    contracts: registration.contracts,
    validation: registration.validation,
    capabilities: registration.capabilities,
    registrationChecklist: generateRegistrationChecklist(blueprint, registration),
  };

  return JSON.stringify(manifest, null, 2);
}

/**
 * Generate registration checklist for runtime validation
 */
function generateRegistrationChecklist(blueprint, registration) {
  const checks = [];

  // Artifact existence checks
  checks.push({
    category: 'artifacts',
    name: 'All required artifacts generated',
    status: 'pending',
    items: registration.artifacts.artifacts.map(a => ({
      artifact: a.name,
      type: a.type,
      required: a.type !== 'documentation' && a.type !== 'search',
    })),
  });

  // Capability checks
  checks.push({
    category: 'capabilities',
    name: 'Enabled capabilities properly configured',
    status: 'pending',
    items: registration.capabilities.capabilities
      .filter(c => c.enabled)
      .map(c => ({
        capability: c.name,
        enabled: true,
        configured: true,
      })),
  });

  // Contract checks
  checks.push({
    category: 'contracts',
    name: 'All contracts present',
    status: 'pending',
    items: [
      { contract: 'repository', present: true },
      { contract: 'service', present: true },
      { contract: 'validator', present: true },
      { contract: 'api', present: true },
      { contract: 'permissions', present: blueprint.permissions?.rules?.length > 0 },
    ],
  });

  // Validation checks
  checks.push({
    category: 'validation',
    name: 'Validation rules properly configured',
    status: 'pending',
    items: [
      {
        check: 'Required field validation',
        count: blueprint.fields?.required?.length || 0,
      },
      {
        check: 'Unique constraint validation',
        count: blueprint.fields?.unique?.length || 0,
      },
      {
        check: 'Custom validation rules',
        count: registration.validation.customValidations,
      },
    ],
  });

  // Metadata checks
  checks.push({
    category: 'metadata',
    name: 'Registration metadata complete',
    status: 'pending',
    items: [
      { field: 'entity name', present: !!registration.metadata.registryKey },
      { field: 'namespace', present: !!blueprint.metadata.namespace },
      { field: 'version', present: !!registration.manifest.version.semantic },
      { field: 'classification', present: !!registration.manifest.classification },
    ],
  });

  return {
    totalChecks: checks.length,
    completionPercentage: 0,
    checks: checks,
    readinessScore: calculateReadinessScore(blueprint, registration),
  };
}

/**
 * Calculate readiness score (0-100) for runtime registration
 */
function calculateReadinessScore(blueprint, registration) {
  let score = 0;
  const maxScore = 100;

  // Artifacts present (20 points)
  if (registration.artifacts.total >= 14) score += 20;
  else if (registration.artifacts.total >= 10) score += 15;
  else if (registration.artifacts.total >= 5) score += 10;

  // Fields defined (15 points)
  if (blueprint.fields?.all?.length > 0) score += 15;

  // Relationships defined (10 points)
  if (blueprint.relationships?.all?.length > 0) score += 10;

  // Lifecycle configured (15 points)
  if (Object.keys(blueprint.lifecycle?.states || {}).length > 0) score += 15;

  // Permissions configured (10 points)
  if (blueprint.permissions?.rules?.length > 0) score += 10;

  // Validation configured (10 points)
  if (blueprint.validation?.constraints?.length > 0) score += 10;

  // API contracts generated (5 points)
  if (blueprint.api?.endpoints?.length > 0) score += 5;

  return Math.min(score, maxScore);
}
