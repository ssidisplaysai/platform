/**
 * ModuleExpander - Phase 11
 *
 * Formalizes module metadata into comprehensive module model.
 * Establishes module boundaries and ownership for enterprise architecture.
 *
 * Purpose:
 *   - Expand module metadata from namespace and entity definitions
 *   - Establish module boundaries as a compiler concept
 *   - Create module specifications and registries
 *   - Enable metadata-driven modular architecture
 *
 * Consumes: Entity namespace, entity metadata
 * Produces: Module metadata section for blueprint
 *
 * @module tools/genesis/compiler/metadata-engine/ModuleExpander
 */

/**
 * Module registry mapping namespaces to module definitions
 */
const MODULE_REGISTRY = {
  crm: {
    name: 'CRM',
    description: 'Customer Relationship Management',
    namespace: 'crm',
    tier: 'core',
    domain: 'sales',
    objects: [],
  },
  vendorManagement: {
    name: 'Vendor Management',
    description: 'Vendor and Supplier Management',
    namespace: 'vendorManagement',
    tier: 'core',
    domain: 'procurement',
    objects: [],
  },
  projects: {
    name: 'Projects',
    description: 'Project Management and Delivery',
    namespace: 'projects',
    tier: 'core',
    domain: 'operations',
    objects: [],
  },
  assetManagement: {
    name: 'Asset Management',
    description: 'Asset Tracking and Maintenance',
    namespace: 'assetManagement',
    tier: 'core',
    domain: 'operations',
    objects: [],
  },
  inventory: {
    name: 'Inventory',
    description: 'Inventory Management and Tracking',
    namespace: 'inventory',
    tier: 'core',
    domain: 'operations',
    objects: [],
  },
  manufacturing: {
    name: 'Manufacturing',
    description: 'Manufacturing and Production',
    namespace: 'manufacturing',
    tier: 'core',
    domain: 'operations',
    objects: [],
  },
  workManagement: {
    name: 'Work Management',
    description: 'Work Order and Task Management',
    namespace: 'workManagement',
    tier: 'core',
    domain: 'operations',
    objects: [],
  },
};

/**
 * Entity-to-module mapping
 */
const ENTITY_MODULE_MAP = {
  Customer: 'crm',
  Vendor: 'vendorManagement',
  Project: 'projects',
  Asset: 'assetManagement',
  InventoryItem: 'inventory',
  Machine: 'manufacturing',
  WorkOrder: 'workManagement',
};

/**
 * Expand module metadata
 *
 * @param {string} entityName - Entity name (e.g., 'Customer')
 * @param {string} namespace - Namespace from metadata
 * @param {Array} expandedFields - Expanded field definitions
 * @param {Array} expandedRelationships - Expanded relationship definitions
 * @param {Object} expandedCapabilities - Expanded capabilities
 * @returns {Object} Module metadata model
 */
export function expandModule(entityName, namespace, expandedFields, expandedRelationships, expandedCapabilities) {
  const moduleKey = ENTITY_MODULE_MAP[entityName] || deriveModuleFromNamespace(namespace);
  const moduleDefinition = MODULE_REGISTRY[moduleKey] || createDefaultModule(moduleKey, namespace);

  return {
    ownership: generateModuleOwnership(entityName, moduleKey, moduleDefinition),
    module: moduleDefinition,
    boundaries: generateModuleBoundaries(expandedFields, expandedRelationships, expandedCapabilities),
    registry: generateModuleRegistry(moduleKey, entityName, moduleDefinition),
    integration: generateIntegrationPoints(entityName, moduleKey),
    architecture: generateArchitectureInfo(moduleKey, moduleDefinition),
  };
}

/**
 * Generate module ownership information
 */
function generateModuleOwnership(entityName, moduleKey, moduleDefinition) {
  return {
    entityName: entityName,
    moduleKey: moduleKey,
    moduleName: moduleDefinition.name,
    moduleNamespace: moduleDefinition.namespace,
    ownershipPath: `/modules/${moduleDefinition.namespace}/${entityName}`,
    ownershipRegistryKey: `${moduleDefinition.namespace}:${entityName}`,
    exclusive: true,
    version: '1.0.0',
  };
}

/**
 * Generate module boundaries
 *
 * Defines what this entity exposes to other modules
 */
function generateModuleBoundaries(expandedFields, expandedRelationships, expandedCapabilities) {
  // Identify relationships to other modules
  const externalRelationships = expandedRelationships.filter(r => {
    // External if target entity is in different module
    const targetModule = ENTITY_MODULE_MAP[r.target];
    return targetModule !== undefined;
  });

  return {
    publicFields: expandedFields
      .filter(f => !f.internal)
      .map(f => f.name),
    internalFields: expandedFields
      .filter(f => f.internal)
      .map(f => f.name),
    publicRelationships: externalRelationships.map(r => ({
      name: r.name,
      target: r.target,
      type: r.type,
      targetModule: ENTITY_MODULE_MAP[r.target],
    })),
    internalRelationships: expandedRelationships
      .filter(r => !externalRelationships.includes(r))
      .map(r => ({
        name: r.name,
        target: r.target,
        type: r.type,
      })),
    capabilities: {
      audit: expandedCapabilities.audit?.enabled || false,
      search: expandedCapabilities.search?.enabled || false,
      validation: expandedCapabilities.validation?.enabled || false,
      permissions: expandedCapabilities.permissions?.enabled || false,
      events: expandedCapabilities.events?.enabled || false,
    },
  };
}

/**
 * Generate module registry information
 */
function generateModuleRegistry(moduleKey, entityName, moduleDefinition) {
  return {
    moduleKey: moduleKey,
    moduleName: moduleDefinition.name,
    moduleNamespace: moduleDefinition.namespace,
    moduleTier: moduleDefinition.tier,
    moduleDomain: moduleDefinition.domain,
    registryPath: `/registry/modules/${moduleDefinition.namespace}`,
    entityPath: `/registry/modules/${moduleDefinition.namespace}/entities/${entityName}`,
    discoverable: true,
    indexed: true,
  };
}

/**
 * Generate integration points
 *
 * Documents how this entity interacts with other modules
 */
function generateIntegrationPoints(entityName, moduleKey) {
  const integrations = [];

  // Based on entity-to-module relationships
  const relationshipMap = {
    Customer: ['projects', 'workManagement'],
    Vendor: [],
    Project: ['crm', 'workManagement'],
    Asset: ['assetManagement', 'maintenance'],
    InventoryItem: ['inventory', 'manufacturing'],
    Machine: ['manufacturing', 'workManagement'],
    WorkOrder: ['workManagement', 'projects'],
  };

  const relatedModules = relationshipMap[entityName] || [];
  relatedModules.forEach(relatedModule => {
    const relatedModuleKey = relatedModule;
    if (MODULE_REGISTRY[relatedModuleKey]) {
      integrations.push({
        module: MODULE_REGISTRY[relatedModuleKey].name,
        moduleNamespace: relatedModuleKey,
        type: 'reference',
        bidirectional: true,
      });
    }
  });

  return {
    count: integrations.length,
    integrations: integrations,
  };
}

/**
 * Generate architecture information
 */
function generateArchitectureInfo(moduleKey, moduleDefinition) {
  return {
    moduleKey: moduleKey,
    moduleName: moduleDefinition.name,
    description: moduleDefinition.description,
    tier: moduleDefinition.tier,
    domain: moduleDefinition.domain,
    isCore: moduleDefinition.tier === 'core',
    isExtension: moduleDefinition.tier === 'extension',
    isMono: true,
    supportsPolymorphism: true,
  };
}

/**
 * Derive module from namespace if not explicitly mapped
 */
function deriveModuleFromNamespace(namespace) {
  // Try to match namespace with module registry keys
  for (const [key, module] of Object.entries(MODULE_REGISTRY)) {
    if (module.namespace === namespace) {
      return key;
    }
  }
  return namespace;
}

/**
 * Create default module definition for unmapped namespace
 */
function createDefaultModule(moduleKey, namespace) {
  return {
    name: moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1),
    description: `Module: ${moduleKey}`,
    namespace: namespace || moduleKey,
    tier: 'extension',
    domain: 'custom',
    objects: [],
  };
}

/**
 * Get all modules
 */
export function getAllModules() {
  return Object.values(MODULE_REGISTRY);
}

/**
 * Get module by key
 */
export function getModuleByKey(moduleKey) {
  return MODULE_REGISTRY[moduleKey];
}

/**
 * Get entity module
 */
export function getEntityModule(entityName) {
  const moduleKey = ENTITY_MODULE_MAP[entityName];
  return moduleKey ? MODULE_REGISTRY[moduleKey] : null;
}
