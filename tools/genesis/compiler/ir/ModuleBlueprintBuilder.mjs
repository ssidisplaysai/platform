/**
 * ModuleBlueprintBuilder - Constructs ModuleBlueprint from source data
 *
 * Transforms module metadata, object registrations, and module data into
 * a canonical ModuleBlueprint IR ready for rendering.
 *
 * Purpose:
 *   - Aggregate object registration and module data
 *   - Build consolidated module metadata
 *   - Calculate module relationships and dependencies
 *   - Compute quality metrics
 *   - Generate module contracts (navigation, API, documentation)
 *
 * Process:
 *   1. Load module metadata (from ModuleRegistry)
 *   2. Identify member objects (via ENTITY_MODULE_MAP)
 *   3. Load registration manifests for each member
 *   4. Load module manifests for each member
 *   5. Aggregate capabilities, permissions, lifecycle
 *   6. Calculate inter-module relationships
 *   7. Generate module contracts (navigation, API, documentation)
 *   8. Compute completeness and quality metrics
 *   9. Return complete ModuleBlueprint
 *
 * @module tools/genesis/compiler/ir/ModuleBlueprintBuilder
 */

import fs from 'fs';
import path from 'path';
import { generateNavigation } from '../contracts/ModuleNavigationGenerator.mjs';
import { generateAPI } from '../contracts/ModuleAPIGenerator.mjs';
import { generateDocumentation } from '../contracts/ModuleDocumentationGenerator.mjs';
import { generateDashboard } from '../contracts/ModuleDashboardGenerator.mjs';
import { generateWorkflow } from '../contracts/ModuleWorkflowGenerator.mjs';
import { generateAutomation } from '../contracts/ModuleAutomationGenerator.mjs';
import { generateAIAgent } from '../contracts/ModuleAIAgentGenerator.mjs';
import { generateKnowledgeContext } from '../contracts/ModuleKnowledgeContextGenerator.mjs';

/**
 * Build a complete ModuleBlueprint from source data
 *
 * @param {string} moduleKey - Module key (e.g., 'crm')
 * @param {Object} moduleMetadata - Module definition from MODULE_REGISTRY
 * @param {Array<string>} memberObjects - Entity names belonging to module
 * @param {Object} moduleRegistry - Complete MODULE_REGISTRY for lookups
 * @param {Object} entityModuleMap - Complete ENTITY_MODULE_MAP for relationships
 * @returns {Object} Complete ModuleBlueprint ready for rendering
 */
export function buildModuleBlueprint(
  moduleKey,
  moduleMetadata,
  memberObjects,
  moduleRegistry,
  entityModuleMap
) {
  // Load member object data
  const members = loadMemberObjects(memberObjects);

  // Calculate module relationships
  const relationships = calculateModuleRelationships(memberObjects, entityModuleMap, moduleRegistry);

  // Aggregate capabilities
  const capabilities = aggregateCapabilities(members);

  // Aggregate permissions
  const permissions = aggregatePermissions(members);

  // Aggregate lifecycle and events
  const lifecycle = aggregateLifecycle(members);

  // Aggregate artifacts
  const artifacts = aggregateArtifacts(members, memberObjects);

  // Calculate quality metrics
  const quality = calculateQualityMetrics(members, memberObjects, relationships);

  // Generate module contracts
  const navigation = generateNavigation(moduleKey, moduleMetadata, memberObjects);
  
  // Build member object metadata map for API and documentation generation
  const memberObjectDataMap = {};
  for (const member of members) {
    memberObjectDataMap[member.name] = {
      registration: member.registration,
      module: member.module,
      relationships: member.module?.boundaries?.public?.relationships || []
    };
  }
  
  const api = generateAPI(moduleKey, moduleMetadata, memberObjects, memberObjectDataMap);
  const documentation = generateDocumentation(moduleMetadata, memberObjects, memberObjectDataMap, navigation, api);
  
  // Build a partial blueprint for dashboard generation (before final return)
  let dashboardBlueprint = null;
  
  const blueprint = {
    metadata: {
      schema: 'https://genesis.internal/schema/module-blueprint.json',
      version: '1.0.0',
      generated: {
        at: new Date().toISOString(),
        by: 'Genesis Module Compiler v0',
        phase: 'Module-Aware Architecture'
      }
    },

    module: {
      id: moduleKey,
      name: moduleMetadata.name,
      namespace: moduleMetadata.namespace,
      description: moduleMetadata.description,
      tier: moduleMetadata.tier,
      domain: moduleMetadata.domain,
      registryPath: `/registry/modules/${moduleMetadata.namespace}`
    },

    members: {
      count: members.length,
      objects: members.map(member => ({
        name: member.name,
        registryKey: member.registryKey,
        path: `/modules/${moduleMetadata.namespace}/${member.name}`,
        registration: {
          schema: member.registration?.$schema || '',
          version: member.registration?.version?.semantic || '1.0.0',
          classification: member.registration?.classification || {},
          structure: member.registration?.structure || {}
        },
        module: {
          tier: member.module?.module?.tier || moduleMetadata.tier,
          domain: member.module?.module?.domain || moduleMetadata.domain
        },
        artifacts: member.artifacts || []
      }))
    },

    relationships,
    capabilities,
    permissions,
    lifecycle,
    artifacts,

    navigation,
    api,
    documentation,

    registry: {
      modulePath: `/registry/modules/${moduleMetadata.namespace}`,
      objectsPath: `/registry/modules/${moduleMetadata.namespace}/entities`,
      discoverable: true,
      indexed: true,
      registryKey: `module:${moduleMetadata.namespace}`
    },

    quality
  };

  // Generate dashboard with complete blueprint context
  dashboardBlueprint = generateDashboard(moduleKey, moduleMetadata, memberObjects, blueprint);
  blueprint.dashboard = dashboardBlueprint;

  // Generate workflow with complete blueprint context
  const workflowBlueprint = generateWorkflow(moduleKey, moduleMetadata, memberObjects, blueprint);
  blueprint.workflow = workflowBlueprint;

  // Generate automation with complete blueprint context
  const automationBlueprint = generateAutomation(moduleKey, moduleMetadata, memberObjects, blueprint);
  blueprint.automation = automationBlueprint;

  // Generate AI agent with complete blueprint context (Phase 14)
  const aiAgentBlueprint = generateAIAgent(moduleKey, moduleMetadata, members, blueprint);
  blueprint.aiAgent = aiAgentBlueprint;

  // Generate knowledge context for AI agents
  const knowledgeContextData = generateKnowledgeContext(moduleKey, moduleMetadata, members, blueprint);
  blueprint.knowledgeContext = knowledgeContextData;

  return blueprint;
}

/**
 * Load object registration and module data
 *
 * @param {Array<string>} objectNames - Entity names to load
 * @returns {Array<Object>} Loaded object metadata
 */
function loadMemberObjects(objectNames) {
  const members = [];

  for (const objectName of objectNames) {
    try {
      const registrationPath = path.join(
        process.cwd(),
        'out', 'generated', 'entities', objectName,
        `${objectName}.registration.json`
      );

      const modulePath = path.join(
        process.cwd(),
        'out', 'generated', 'entities', objectName,
        `${objectName}.module.json`
      );

      let registration = null;
      let moduleData = null;

      if (fs.existsSync(registrationPath)) {
        registration = JSON.parse(fs.readFileSync(registrationPath, 'utf-8'));
      }

      if (fs.existsSync(modulePath)) {
        moduleData = JSON.parse(fs.readFileSync(modulePath, 'utf-8'));
      }

      // List all artifacts in object directory
      const objectDir = path.join(process.cwd(), 'out', 'generated', 'entities', objectName);
      const artifacts = [];
      if (fs.existsSync(objectDir)) {
        const files = fs.readdirSync(objectDir);
        for (const file of files) {
          if (file.startsWith(objectName) && file !== `${objectName}.json`) {
            artifacts.push(file);
          }
        }
      }

      members.push({
        name: objectName,
        registryKey: registration?.entity?.namespace ? `${registration.entity.namespace}:${objectName}` : objectName,
        registration,
        module: moduleData,
        artifacts
      });
    } catch (error) {
      console.warn(`Warning: Could not load metadata for ${objectName}: ${error.message}`);
      members.push({
        name: objectName,
        registryKey: objectName,
        registration: null,
        module: null,
        artifacts: []
      });
    }
  }

  return members;
}

/**
 * Calculate module-to-module relationships
 *
 * @param {Array<string>} memberObjects - Objects in this module
 * @param {Object} entityModuleMap - Entity-to-module mapping
 * @param {Object} moduleRegistry - All module definitions
 * @returns {Object} Module relationships and dependencies
 */
function calculateModuleRelationships(memberObjects, entityModuleMap, moduleRegistry) {
  const dependencies = new Map();
  const dependents = new Map();
  const processedModules = new Set();

  // For each member object, find its cross-module relationships
  for (const objectName of memberObjects) {
    const modulePath = path.join(
      process.cwd(),
      'out', 'generated', 'entities', objectName,
      `${objectName}.module.json`
    );

    if (fs.existsSync(modulePath)) {
      try {
        const moduleData = JSON.parse(fs.readFileSync(modulePath, 'utf-8'));

        // Get cross-module integrations
        if (moduleData.integrations?.modules) {
          for (const integration of moduleData.integrations.modules) {
            const depModuleNamespace = integration.moduleNamespace;
            if (!dependencies.has(depModuleNamespace)) {
              dependencies.set(depModuleNamespace, {
                module: integration.module,
                namespace: depModuleNamespace,
                type: 'reference',
                entities: []
              });
            }
            dependencies.get(depModuleNamespace).entities.push(objectName);
          }
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }
  }

  // Convert maps to arrays
  const depArray = Array.from(dependencies.values());
  const countRelated = new Set(depArray.map(d => d.namespace)).size;

  return {
    count: countRelated,
    dependencies: depArray,
    dependents: Array.from(dependents.values())
  };
}

/**
 * Aggregate capability status across all member objects
 *
 * @param {Array<Object>} members - Loaded member objects
 * @returns {Object} Aggregated capability status
 */
function aggregateCapabilities(members) {
  const capabilityMap = new Map([
    ['audit', { name: 'audit', enabled: 0, disabled: 0, total: 0, percentage: 0 }],
    ['search', { name: 'search', enabled: 0, disabled: 0, total: 0, percentage: 0 }],
    ['validation', { name: 'validation', enabled: 0, disabled: 0, total: 0, percentage: 0 }],
    ['permissions', { name: 'permissions', enabled: 0, disabled: 0, total: 0, percentage: 0 }],
    ['events', { name: 'events', enabled: 0, disabled: 0, total: 0, percentage: 0 }]
  ]);

  for (const member of members) {
    if (member.registration?.capabilities?.capabilities) {
      for (const cap of member.registration.capabilities.capabilities) {
        const capName = cap.name;
        if (capabilityMap.has(capName)) {
          const stat = capabilityMap.get(capName);
          stat.total += 1;
          if (cap.enabled) {
            stat.enabled += 1;
          } else {
            stat.disabled += 1;
          }
        }
      }
    }
  }

  // Calculate percentages
  for (const stat of capabilityMap.values()) {
    if (stat.total > 0) {
      stat.percentage = Math.round((stat.enabled / stat.total) * 100);
    }
  }

  return {
    summary: Array.from(capabilityMap.values())
  };
}

/**
 * Aggregate permissions across all member objects
 *
 * @param {Array<Object>} members - Loaded member objects
 * @returns {Object} Aggregated permission summary
 */
function aggregatePermissions(members) {
  const roleSet = new Set();
  const policyMap = new Map();
  let rolePoliciesCount = 0;

  for (const member of members) {
    if (member.registration?.permissions?.summary?.roles) {
      for (const role of member.registration.permissions.summary.roles) {
        roleSet.add(role);
      }
    }

    if (member.registration?.permissions?.policies) {
      for (const policy of member.registration.permissions.policies) {
        const policyKey = `${policy.name}-${policy.action}`;
        if (!policyMap.has(policyKey)) {
          policyMap.set(policyKey, {
            name: policy.name,
            action: policy.action,
            appliedToCount: 0
          });
        }
        policyMap.get(policyKey).appliedToCount += 1;
      }
    }

    if (member.registration?.permissions?.summary?.rolePoliciesCount) {
      rolePoliciesCount += member.registration.permissions.summary.rolePoliciesCount;
    }
  }

  return {
    roles: Array.from(roleSet),
    rolePoliciesCount,
    policies: Array.from(policyMap.values())
  };
}

/**
 * Aggregate lifecycle and events across all member objects
 *
 * @param {Array<Object>} members - Loaded member objects
 * @returns {Object} Aggregated lifecycle and event summary
 */
function aggregateLifecycle(members) {
  const stateSet = new Set();
  const eventSet = new Set();
  const transitionSet = new Set();
  let totalStates = 0;
  let totalTransitions = 0;

  for (const member of members) {
    if (member.registration?.lifecycle) {
      const lc = member.registration.lifecycle;
      
      // Handle states count
      if (typeof lc.states === 'number') {
        totalStates += lc.states;
      } else if (Array.isArray(lc.states)) {
        for (const state of lc.states) {
          stateSet.add(state);
        }
      }
      
      // Handle transitions count
      if (typeof lc.transitions === 'number') {
        totalTransitions += lc.transitions;
      } else if (Array.isArray(lc.transitions)) {
        for (const transition of lc.transitions) {
          transitionSet.add(`${transition.from}->${transition.to}`);
        }
      }
    }
  }

  const transitions = Array.from(transitionSet).map(t => {
    const [from, to] = t.split('->');
    return { from, to };
  });

  return {
    states: Array.from(stateSet),
    events: Array.from(eventSet),
    stateCount: stateSet.size > 0 ? stateSet.size : totalStates,
    eventCount: eventSet.size,
    transitions: transitions.length > 0 ? transitions : [],
    totalStatesCounted: totalStates,
    totalTransitionsCounted: totalTransitions
  };
}

/**
 * Aggregate artifacts for all member objects
 *
 * @param {Array<Object>} members - Loaded member objects
 * @param {Array<string>} memberObjects - Object names
 * @returns {Object} Aggregated artifact references
 */
function aggregateArtifacts(members, memberObjects) {
  const artifactsByType = new Map();
  let totalCount = 0;

  for (const member of members) {
    for (const artifact of member.artifacts || []) {
      // Extract file extension to determine type
      const ext = artifact.substring(artifact.lastIndexOf('.') + 1);
      let artifactType = 'other';

      if (artifact.includes('.ts') || artifact.includes('.mjs') || artifact.includes('.js')) {
        if (artifact.includes('Repository')) artifactType = 'Repository';
        else if (artifact.includes('Service')) artifactType = 'Service';
        else if (artifact.includes('Validator')) artifactType = 'Validator';
        else if (artifact.includes('test')) artifactType = 'Tests';
        else if (artifact.includes('Documentation')) artifactType = 'Documentation';
        else artifactType = 'TypeScript';
      } else if (artifact.includes('json')) {
        if (artifact.includes('registration')) artifactType = 'Registration';
        else if (artifact.includes('module')) artifactType = 'Module';
        else artifactType = 'JSON';
      }

      if (!artifactsByType.has(artifactType)) {
        artifactsByType.set(artifactType, {
          type: artifactType,
          count: 0,
          files: []
        });
      }

      const typeData = artifactsByType.get(artifactType);
      typeData.count += 1;
      typeData.files.push(artifact);
      totalCount += 1;
    }
  }

  return {
    totalCount,
    byType: Array.from(artifactsByType.values())
  };
}

/**
 * Calculate module quality metrics
 *
 * @param {Array<Object>} members - Loaded member objects
 * @param {Array<string>} memberObjects - Object names
 * @param {Object} relationships - Module relationships
 * @returns {Object} Quality metrics and completeness score
 */
function calculateQualityMetrics(members, memberObjects, relationships) {
  let score = 0;
  let maxScore = 100;

  // Check 1: All members have registrations (30 points)
  const registrationsPresent = members.filter(m => m.registration).length;
  score += (registrationsPresent / memberObjects.length) * 30;

  // Check 2: All members have module manifests (20 points)
  const modulesPresent = members.filter(m => m.module).length;
  score += (modulesPresent / memberObjects.length) * 20;

  // Check 3: All members have artifacts (15 points)
  const artifactsPresent = members.filter(m => m.artifacts.length > 0).length;
  score += (artifactsPresent / memberObjects.length) * 15;

  // Check 4: Module has relationships documented (15 points)
  if (relationships.dependencies.length > 0 || relationships.dependents.length > 0) {
    score += 15;
  }

  // Check 5: Capabilities aggregated (10 points)
  score += 10;

  // Check 6: Permissions aggregated (10 points)
  score += 10;

  const checks = [
    registrationsPresent === memberObjects.length ? '✓' : '✗' + ' All registrations present',
    modulesPresent === memberObjects.length ? '✓' : '✗' + ' All module manifests present',
    artifactsPresent === memberObjects.length ? '✓' : '✗' + ' All artifacts present',
    relationships.dependencies.length > 0 ? '✓' : '✗' + ' Module relationships documented',
    '✓ Capabilities aggregated',
    '✓ Permissions aggregated'
  ];

  return {
    completeness: Math.round(score),
    maxScore,
    percentage: Math.round(score),
    complete: score >= 80,
    validation: {
      status: score >= 80 ? 'valid' : 'pending',
      checks,
      passed: checks.filter(c => c.startsWith('✓')).length,
      total: checks.length
    },
    deploymentReady: {
      ready: score >= 80,
      percentage: Math.round(score)
    }
  };
}

export {};
