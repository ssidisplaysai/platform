/**
 * CodeGenerationEngine
 *
 * Orchestrates metadata-driven code generation.
 * Loads entity definitions, expands metadata, and generates enterprise object slices.
 * Uses a plugin-based RendererRegistry for modular artifact generation.
 *
 * @module tools/genesis/compiler/CodeGenerationEngine
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { parseYAML } from '../utils/SimpleYAMLParser.mjs';
import { expandAllFields, getSearchableFields } from './metadata-engine/FieldExpander.mjs';
import { expandAllRelationships } from './metadata-engine/RelationshipExpander.mjs';
import { expandCapabilities } from './metadata-engine/CapabilityExpander.mjs';
import { expandLifecycle } from './metadata-engine/LifecycleExpander.mjs';
import { expandEvents } from './metadata-engine/EventExpander.mjs';
import { expandPermissions } from './metadata-engine/PermissionExpander.mjs';
import { expandPolicies } from './metadata-engine/PolicyExpander.mjs';
import { expandSearch } from './metadata-engine/SearchExpander.mjs';
import { expandIndex } from './metadata-engine/IndexExpander.mjs';
import { expandValidation } from './metadata-engine/ValidationExpander.mjs';
import { expandRules } from './metadata-engine/RulesExpander.mjs';
import { expandAPI } from './metadata-engine/APIExpander.mjs';
import { expandTests } from './metadata-engine/TestExpander.mjs';
import { expandRegistration } from './metadata-engine/RegistrationExpander.mjs';
import { expandModule } from './metadata-engine/ModuleExpander.mjs';

import { buildBlueprint } from './ir/BlueprintBuilder.mjs';
import { registerDefaultRenderers, rendererRegistry } from './registry/RendererRegistry.mjs';
import { RendererTargets, generateFileName } from './registry/RendererTarget.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../../..');

/**
 * Generate all artifacts for an entity (enterprise object slice)
 * @param {string} entityName - Entity name (e.g., 'Customer')
 * @param {string} definitionPath - Path to entity YAML definition
 * @param {string} outputDir - Output directory for generated artifacts
 * @returns {Object} Generation result with blueprint and artifacts
 */
export async function generateEntity(entityName, definitionPath, outputDir) {
  console.log(`\n📝 Generating ${entityName} artifacts...`);

  // Load and parse entity definition
  if (!fs.existsSync(definitionPath)) {
    throw new Error(`Entity definition not found: ${definitionPath}`);
  }

  const yamlContent = fs.readFileSync(definitionPath, 'utf-8');
  const rawMetadata = parseYAML(yamlContent);

  // Expand metadata
  const expandedFields = expandAllFields(rawMetadata.fields || {});
  const expandedRelationships = expandAllRelationships(rawMetadata.relationships);
  const expandedCapabilities = expandCapabilities(rawMetadata.capabilities);
  const expandedLifecycle = expandLifecycle(rawMetadata.lifecycle);
  const expandedEvents = expandEvents(expandedLifecycle, expandedCapabilities);
  const expandedPermissions = expandPermissions(rawMetadata.capabilities?.permissions);
  const expandedPolicies = expandPolicies(rawMetadata.policies, expandedLifecycle);
  const expandedSearch = expandSearch(rawMetadata.capabilities?.search, expandedFields, expandedLifecycle, expandedRelationships);
  const expandedIndex = expandIndex(rawMetadata.capabilities?.search, expandedFields, entityName);
  const expandedValidation = expandValidation(rawMetadata.capabilities?.validation, expandedFields, expandedRelationships);
  const expandedRules = expandRules(rawMetadata.validation?.rules, expandedLifecycle, expandedFields, expandedRelationships);
  const expandedAPI = expandAPI(rawMetadata.api, entityName, expandedFields, expandedRelationships, expandedLifecycle, expandedPermissions, expandedValidation);
  const expandedTests = expandTests(entityName, expandedFields, expandedRelationships, expandedLifecycle, expandedPermissions, expandedValidation, expandedRules, expandedSearch, expandedAPI);
  const expandedRegistration = expandRegistration(entityName, rawMetadata.metadata?.namespace || 'default', expandedFields, expandedRelationships, expandedCapabilities, expandedLifecycle, expandedPermissions, expandedRules, expandedSearch, expandedAPI);
  const expandedModule = expandModule(entityName, rawMetadata.metadata?.namespace || 'default', expandedFields, expandedRelationships, expandedCapabilities);

  // Add search fields to capabilities
  const searchableFields = getSearchableFields(expandedFields, rawMetadata.capabilities?.search);
  expandedCapabilities.searchFields = searchableFields.map(f => f.name);

  // Build the canonical compiler IR (EnterpriseObjectBlueprint)
  const blueprint = buildBlueprint(
    entityName,
    rawMetadata,
    expandedFields,
    expandedRelationships,
    expandedCapabilities,
    expandedLifecycle,
    expandedEvents,
    expandedPermissions,
    expandedPolicies,
    expandedSearch,
    expandedIndex,
    expandedValidation,
    expandedRules,
    expandedAPI,
    expandedTests,
    expandedRegistration,
    expandedModule,
    definitionPath
  );

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const artifacts = {};

  // Render all targets using the plugin registry
  const renderedArtifacts = rendererRegistry.renderAll(blueprint);

  // Write all artifacts deterministically
  const targetOrder = [
    'repository', 'service', 'validator', 'documentation',
    'permissions', 'events', 'search', 'tests',
    'openapi', 'graphql', 'dtos', 'rest-contract', 'error-contracts',
    'registration', 'module', 'blueprint', 'metadata'
  ];

  for (const targetId of targetOrder) {
    if (!renderedArtifacts.has(targetId)) {
      continue;
    }

    const content = renderedArtifacts.get(targetId);
    if (!content) {
      continue;
    }

    const target = RendererTargets[Object.keys(RendererTargets).find(
      k => RendererTargets[k].id === targetId
    )];

    if (!target) {
      continue;
    }

    const fileName = generateFileName(entityName, targetId);
    const filePath = path.join(outputDir, fileName);

    // Special handling for blueprint and metadata
    if (targetId === 'blueprint') {
      fs.writeFileSync(filePath, JSON.stringify(blueprint, null, 2));
    } else if (targetId === 'metadata') {
      const metadata = {
        entity: entityName,
        generatedAt: new Date().toISOString(),
        definition: definitionPath,
        fields: expandedFields,
        relationships: expandedRelationships,
        capabilities: expandedCapabilities,
        lifecycle: expandedLifecycle,
        artifacts,
      };
      fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));
    } else {
      fs.writeFileSync(filePath, content);
    }

    artifacts[targetId] = filePath;
    console.log(`  ✓ ${target.name}: ${path.relative(projectRoot, filePath)}`);
  }

  console.log(`\n✅ ${entityName} generation complete!`);

  return { blueprint, artifacts };
}

/**
 * Generate all entities in definitions directory
 * @param {string} definitionsDir - Path to definitions directory
 * @param {string} outputBaseDir - Base output directory
 * @returns {Array<Object>} Array of generation results
 */
export async function generateAllEntities(definitionsDir, outputBaseDir) {
  const results = [];

  if (!fs.existsSync(definitionsDir)) {
    console.warn(`Definitions directory not found: ${definitionsDir}`);
    return results;
  }

  const files = fs.readdirSync(definitionsDir).filter(f => f.endsWith('.entity.yaml'));

  for (const file of files) {
    const entityName = file.replace('.entity.yaml', '');
    const definitionPath = path.join(definitionsDir, file);
    const outputDir = path.join(outputBaseDir, entityName);

    try {
      const result = await generateEntity(entityName, definitionPath, outputDir);
      results.push({ success: true, entity: entityName, result });
    } catch (error) {
      console.error(`❌ Failed to generate ${entityName}: ${error.message}`);
      results.push({ success: false, entity: entityName, error: error.message });
    }
  }

  return results;
}

/**
 * Main entry point for code generation
 * @param {Object} options - Generation options
 * @param {string} options.entity - Specific entity to generate (optional, if omitted generates all)
 * @param {string} options.outputDir - Output directory
 * @returns {Object} Generation results
 */
export async function generate(options = {}) {
  // Register all renderers on startup
  await registerDefaultRenderers();

  const definitionsDir = path.join(projectRoot, 'definitions/entity');
  const outputDir = options.outputDir || path.join(projectRoot, 'out/generated/entities');

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Genesis Enterprise Slice Generator  ║');
  console.log('║   Metadata-Driven Code Generation    ║');
  console.log('╚════════════════════════════════════════╝\n');

  let results = [];

  if (options.entity) {
    // Generate specific entity
    const definitionPath = path.join(definitionsDir, `${options.entity}.entity.yaml`);
    const entityOutputDir = path.join(outputDir, options.entity);
    try {
      const result = await generateEntity(options.entity, definitionPath, entityOutputDir);
      results.push({ success: true, entity: options.entity, result });
    } catch (error) {
      console.error(`❌ Failed to generate ${options.entity}: ${error.message}`);
      results.push({ success: false, entity: options.entity, error: error.message });
    }
  } else {
    // Generate all entities
    results = await generateAllEntities(definitionsDir, outputDir);
  }

  // Summary
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Generation Summary                  ║');
  console.log('╚════════════════════════════════════════╝\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Total: ${results.length} | Successful: ${successful.length} | Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFailed entities:');
    for (const f of failed) {
      console.log(`  ❌ ${f.entity}: ${f.error}`);
    }
  }

  return { results, outputDir };
}
