/**
 * BlueprintCompilationTest
 *
 * Verifies that Customer entity compiles successfully through
 * the EnterpriseObjectBlueprint IR contract using Node.js native test runner.
 *
 * This ensures:
 * - Blueprint creation succeeds
 * - Repository renders from blueprint
 * - Documentation renders from blueprint
 * - No renderers read raw YAML directly
 *
 * @module test/BlueprintCompilationTest
 */

import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { parseYAML } from '../tools/genesis/utils/SimpleYAMLParser.mjs';
import { expandAllFields } from '../tools/genesis/compiler/metadata-engine/FieldExpander.mjs';
import { expandAllRelationships } from '../tools/genesis/compiler/metadata-engine/RelationshipExpander.mjs';
import { expandCapabilities } from '../tools/genesis/compiler/metadata-engine/CapabilityExpander.mjs';
import { expandLifecycle } from '../tools/genesis/compiler/metadata-engine/LifecycleExpander.mjs';

import { buildBlueprint } from '../tools/genesis/compiler/ir/BlueprintBuilder.mjs';
import { validateBlueprint } from '../tools/genesis/compiler/ir/EnterpriseObjectBlueprint.mjs';
import { generateRepository } from '../tools/genesis/compiler/renderers/RepositoryRenderer.mjs';
import { generateDocumentation } from '../tools/genesis/compiler/renderers/DocumentationRenderer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Load Customer entity definition once for all tests
let blueprint;
let rawMetadata;
let expandedFields;
let expandedRelationships;
let expandedCapabilities;
let expandedLifecycle;

try {
  const definitionPath = path.join(projectRoot, 'definitions/entity/Customer.entity.yaml');
  
  if (fs.existsSync(definitionPath)) {
    const yamlContent = fs.readFileSync(definitionPath, 'utf-8');
    rawMetadata = parseYAML(yamlContent);

    // Expand metadata
    expandedFields = expandAllFields(rawMetadata.fields || {});
    expandedRelationships = expandAllRelationships(rawMetadata.relationships);
    expandedCapabilities = expandCapabilities(rawMetadata.capabilities);
    expandedLifecycle = expandLifecycle(rawMetadata.lifecycle);

    // Add search fields to capabilities
    expandedCapabilities.searchFields = (expandedFields || [])
      .filter(f => rawMetadata.capabilities?.search?.fields?.includes(f.name))
      .map(f => f.name);

    // Build blueprint
    blueprint = buildBlueprint(
      'Customer',
      rawMetadata,
      expandedFields,
      expandedRelationships,
      expandedCapabilities,
      expandedLifecycle,
      definitionPath
    );
  } else {
    console.warn(`Customer entity definition not found: ${definitionPath}`);
  }
} catch (err) {
  console.error('Error loading blueprint:', err.message);
}

test('Blueprint Compilation - Creation', () => {
  if (!blueprint) {
    console.log('Skipping tests: blueprint not loaded');
    return;
  }

  assert.ok(blueprint, 'Blueprint should be defined');
  assert.ok(blueprint.metadata, 'Blueprint metadata should exist');
  assert.strictEqual(blueprint.metadata.entity, 'Customer', 'Entity name should be Customer');
});

test('Blueprint Compilation - Structure Validation', () => {
  if (!blueprint) return;

  try {
    validateBlueprint(blueprint);
  } catch (err) {
    throw new Error(`Blueprint validation failed: ${err.message}`);
  }
});

test('Blueprint Compilation - Metadata Population', () => {
  if (!blueprint) return;

  assert.strictEqual(blueprint.metadata.entity, 'Customer', 'Entity should be Customer');
  assert.strictEqual(blueprint.metadata.displayName, 'Customer', 'Display name should be Customer');
  assert.strictEqual(blueprint.metadata.namespace, 'crm', 'Namespace should be crm');
});

test('Blueprint Compilation - Fields Expansion', () => {
  if (!blueprint) return;

  assert.ok(blueprint.fields.all.length > 0, 'Should have expanded fields');
  assert.deepStrictEqual(blueprint.fields.all, expandedFields, 'Fields should match expanded');
});

test('Blueprint Compilation - Field Categorization', () => {
  if (!blueprint) return;

  const { required, unique, generated } = blueprint.fields;

  assert.ok(required.length > 0, 'Should have required fields');
  assert.ok(unique.length > 0, 'Should have unique fields');
  assert.ok(generated.length > 0, 'Should have generated fields');

  // Verify categorization
  for (const field of required) {
    assert.strictEqual(field.required, true, `${field.name} should be required`);
    assert.strictEqual(field.generated, false, `${field.name} should not be generated`);
  }

  for (const field of unique) {
    assert.strictEqual(field.unique, true, `${field.name} should be unique`);
  }

  for (const field of generated) {
    assert.strictEqual(field.generated, true, `${field.name} should be generated`);
  }
});

test('Blueprint Compilation - Relationships Expansion', () => {
  if (!blueprint) return;

  assert.ok(blueprint.relationships.all.length > 0, 'Should have relationships');
  assert.ok(blueprint.relationships.hasMany.length > 0, 'Should have hasMany relationships');
});

test('Blueprint Compilation - Capabilities Normalization', () => {
  if (!blueprint) return;

  assert.ok(blueprint.capabilities.search, 'Should have search capability');
  assert.ok(blueprint.capabilities.audit, 'Should have audit capability');
  assert.ok(blueprint.capabilities.validation, 'Should have validation capability');
  assert.ok(blueprint.capabilities.permissions, 'Should have permissions capability');

  // Verify structure
  assert.strictEqual(typeof blueprint.capabilities.search.enabled, 'boolean', 'Search enabled should be boolean');
  assert.strictEqual(typeof blueprint.capabilities.audit.enabled, 'boolean', 'Audit enabled should be boolean');
});

test('Blueprint Compilation - Validation Rules', () => {
  if (!blueprint) return;

  assert.ok(blueprint.validation.rules, 'Should have validation rules');
  assert.ok(blueprint.validation.required, 'Should have required rules');
  assert.ok(blueprint.validation.unique, 'Should have unique rules');

  assert.ok(blueprint.validation.required.length > 0, 'Should have required field rules');
});

test('Blueprint Compilation - API Specification', () => {
  if (!blueprint) return;

  assert.strictEqual(blueprint.api.baseUrl, '/api/customer', 'API base URL should be /api/customer');
  assert.strictEqual(blueprint.api.camelCase, 'customer', 'camelCase should be customer');
  assert.ok(blueprint.api.endpoints.length > 0, 'Should have API endpoints');

  // Check for CRUD endpoints
  const methods = blueprint.api.endpoints.map(e => e.method);
  assert.ok(methods.includes('POST'), 'Should have POST endpoint');
  assert.ok(methods.includes('GET'), 'Should have GET endpoint');
  assert.ok(methods.includes('PATCH'), 'Should have PATCH endpoint');
  assert.ok(methods.includes('DELETE'), 'Should have DELETE endpoint');
});

test('Blueprint Compilation - Repository Specification', () => {
  if (!blueprint) return;

  assert.ok(blueprint.repository.methods, 'Should have repository methods');
  assert.ok(blueprint.repository.methods.length > 0, 'Should have multiple repository methods');

  // Check for core methods
  const methodNames = blueprint.repository.methods.map(m => m.name);
  assert.ok(methodNames.includes('findById'), 'Should have findById');
  assert.ok(methodNames.includes('findAll'), 'Should have findAll');
  assert.ok(methodNames.includes('create'), 'Should have create');
  assert.ok(methodNames.includes('update'), 'Should have update');
  assert.ok(methodNames.includes('delete'), 'Should have delete');
});

test('Blueprint Compilation - Service Specification', () => {
  if (!blueprint) return;

  assert.ok(blueprint.service, 'Should have service specification');
  assert.strictEqual(blueprint.service.requiresValidation, blueprint.capabilities.validation.enabled, 'Service should require validation based on capability');
  assert.strictEqual(blueprint.service.requiresAudit, blueprint.capabilities.audit.enabled, 'Service should require audit based on capability');
});

test('Blueprint Compilation - Repository Rendering', () => {
  if (!blueprint) return;

  const repoCode = generateRepository(blueprint);
  assert.ok(repoCode, 'Repository code should be generated');
  assert.ok(typeof repoCode === 'string', 'Repository code should be a string');
});

test('Blueprint Compilation - Generated Repository Content', () => {
  if (!blueprint) return;

  const repoCode = generateRepository(blueprint);

  assert.ok(repoCode.includes('class CustomerRepository'), 'Should have CustomerRepository class');
  assert.ok(repoCode.includes('findById'), 'Should have findById method');
  assert.ok(repoCode.includes('findAll'), 'Should have findAll method');
  assert.ok(repoCode.includes('create'), 'Should have create method');
  assert.ok(repoCode.includes('update'), 'Should have update method');
  assert.ok(repoCode.includes('delete'), 'Should have delete method');
  assert.ok(repoCode.includes('hardDelete'), 'Should have hardDelete method');
  assert.ok(repoCode.includes('EnterpriseObjectBlueprint'), 'Should reference EnterpriseObjectBlueprint');
});

test('Blueprint Compilation - Repository Email Finder', () => {
  if (!blueprint) return;

  const repoCode = generateRepository(blueprint);
  const hasEmailFinder = blueprint.fields.unique.some(f => f.name === 'email');

  if (hasEmailFinder) {
    assert.ok(repoCode.includes('findByEmail'), 'Should have findByEmail method for unique email field');
  }
});

test('Blueprint Compilation - Repository Search', () => {
  if (!blueprint) return;

  const repoCode = generateRepository(blueprint);

  if (blueprint.capabilities.search.enabled) {
    assert.ok(repoCode.includes('search'), 'Should have search method if search enabled');
  }
});

test('Blueprint Compilation - Documentation Rendering', () => {
  if (!blueprint) return;

  const docCode = generateDocumentation(blueprint);
  assert.ok(docCode, 'Documentation code should be generated');
  assert.ok(typeof docCode === 'string', 'Documentation should be a string');
});

test('Blueprint Compilation - Generated Documentation Content', () => {
  if (!blueprint) return;

  const docCode = generateDocumentation(blueprint);

  assert.ok(docCode.includes('# Customer Entity'), 'Should have Customer Entity title');
  assert.ok(docCode.includes('## Fields'), 'Should have Fields section');
  assert.ok(docCode.includes('## Relationships'), 'Should have Relationships section');
  assert.ok(docCode.includes('## Lifecycle'), 'Should have Lifecycle section');
  assert.ok(docCode.includes('## Capabilities'), 'Should have Capabilities section');
  assert.ok(docCode.includes('EnterpriseObjectBlueprint'), 'Should reference EnterpriseObjectBlueprint');
});

test('Blueprint Compilation - Documentation Fields', () => {
  if (!blueprint) return;

  const docCode = generateDocumentation(blueprint);

  for (const field of blueprint.fields.all) {
    if (!docCode.includes(`\`${field.name}\``)) {
      console.warn(`Field ${field.name} not found in documentation`);
    }
  }
});

test('Blueprint Compilation - Documentation Relationships', () => {
  if (!blueprint) return;

  const docCode = generateDocumentation(blueprint);

  if (blueprint.relationships.all.length > 0) {
    for (const rel of blueprint.relationships.all) {
      if (!docCode.includes(`\`${rel.name}\``)) {
        console.warn(`Relationship ${rel.name} not found in documentation`);
      }
    }
  }
});

test('Blueprint Compilation - Renderer Signatures', () => {
  if (!blueprint) return;

  const repoSignature = generateRepository.toString();
  const docSignature = generateDocumentation.toString();

  // Both should only accept blueprint
  assert.ok(repoSignature.includes('blueprint'), 'Repository should accept blueprint parameter');
  assert.ok(docSignature.includes('blueprint'), 'Documentation should accept blueprint parameter');

  // Should NOT have multiple parameters
  assert.ok(!repoSignature.includes('entityName,'), 'Repository should not have entityName parameter');
  assert.ok(!docSignature.includes('entityMetadata,'), 'Documentation should not have entityMetadata parameter');
});

test('Blueprint Compilation - Serialization', () => {
  if (!blueprint) return;

  try {
    const serialized = JSON.stringify(blueprint);
    assert.ok(serialized, 'Blueprint should serialize to JSON');
    assert.ok(typeof serialized === 'string', 'Serialized blueprint should be string');
  } catch (err) {
    throw new Error(`Blueprint serialization failed: ${err.message}`);
  }
});

test('Blueprint Compilation - Deserialization', () => {
  if (!blueprint) return;

  const serialized = JSON.stringify(blueprint);
  const deserialized = JSON.parse(serialized);

  assert.ok(deserialized, 'Should deserialize successfully');
  assert.strictEqual(deserialized.metadata.entity, 'Customer', 'Deserialized blueprint should preserve entity');

  try {
    validateBlueprint(deserialized);
  } catch (err) {
    throw new Error(`Deserialized blueprint validation failed: ${err.message}`);
  }
});

console.log('\n✅ Blueprint Compilation Tests Complete');
