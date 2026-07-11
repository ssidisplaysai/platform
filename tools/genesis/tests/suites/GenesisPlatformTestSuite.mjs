/**
 * GenesisPlatformTestSuite.mjs
 *
 * Genesis Meta Compiler - Test Suite
 * Comprehensive tests for platform blueprint, validation, and inspection
 *
 * @module tools/genesis/tests/suites/GenesisPlatformTestSuite.mjs
 */

import { TestSuite } from '../TestSuite.mjs';
import {
  ComponentDefinition,
  RelationshipDefinition,
  ValidationRule,
  PlatformBlueprint,
  ValidationResult,
  ArchitectureInspection,
  createGenesisPlatformBlueprint
} from '../../compiler/GenesisPlatformBlueprint.mjs';
import { GenesisPlatformValidator } from '../../compiler/GenesisPlatformValidator.mjs';
import { GenesisPlatformInspector } from '../../compiler/GenesisPlatformInspector.mjs';

export default async function createGenesisPlatformTestSuite() {
  const suite = new TestSuite('Genesis Meta Compiler v1');

  // ========== Blueprint Contract Tests ==========

  suite.addTest('ComponentDefinition contract validation', () => {
    const component = new ComponentDefinition({
      name: 'TestComponent',
      type: 'engine',
      description: 'Test component'
    });

    if (!component.id.startsWith('comp-')) throw new Error('Component ID should start with comp-');
    if (component.name !== 'TestComponent') throw new Error('Component name mismatch');
    if (component.type !== 'engine') throw new Error('Component type mismatch');
    if (component.status_lifecycle !== 'draft') throw new Error('Initial status should be draft');
  });

  suite.addTest('ComponentDefinition requires name', () => {
    try {
      new ComponentDefinition({ type: 'engine' });
      throw new Error('Should have thrown');
    } catch (e) {
      if (e.message !== 'ComponentDefinition requires name') throw e;
    }
  });

  suite.addTest('ComponentDefinition requires type', () => {
    try {
      new ComponentDefinition({ name: 'Test' });
      throw new Error('Should have thrown');
    } catch (e) {
      if (e.message !== 'ComponentDefinition requires type') throw e;
    }
  });

  suite.addTest('RelationshipDefinition contract validation', () => {
    const rel = new RelationshipDefinition({
      source: 'Component1',
      target: 'Component2',
      type: 'dependency',
      description: 'Test relationship'
    });

    if (!rel.id.startsWith('rel-')) throw new Error('Relationship ID should start with rel-');
    if (rel.source !== 'Component1') throw new Error('Relationship source mismatch');
    if (rel.target !== 'Component2') throw new Error('Relationship target mismatch');
    if (rel.type !== 'dependency') throw new Error('Relationship type mismatch');
  });

  suite.addTest('RelationshipDefinition requires source', () => {
    try {
      new RelationshipDefinition({ target: 'T', type: 'dependency' });
      throw new Error('Should have thrown');
    } catch (e) {
      if (e.message !== 'RelationshipDefinition requires source') throw e;
    }
  });

  suite.addTest('ValidationRule contract validation', () => {
    const rule = new ValidationRule({
      name: 'TestRule',
      rule: 'Test rule definition',
      target: 'component',
      severity: 'critical'
    });

    if (!rule.id.startsWith('rule-')) throw new Error('Rule ID should start with rule-');
    if (rule.name !== 'TestRule') throw new Error('Rule name mismatch');
    if (rule.severity !== 'critical') throw new Error('Rule severity mismatch');
  });

  suite.addTest('ValidationRule requires name', () => {
    try {
      new ValidationRule({ rule: 'test' });
      throw new Error('Should have thrown');
    } catch (e) {
      if (e.message !== 'ValidationRule requires name') throw e;
    }
  });

  suite.addTest('PlatformBlueprint contract validation', () => {
    const blueprint = new PlatformBlueprint({
      name: 'TestPlatform',
      version: '1.0.0'
    });

    if (!blueprint.id.startsWith('pb-')) throw new Error('Blueprint ID should start with pb-');
    if (blueprint.name !== 'TestPlatform') throw new Error('Blueprint name mismatch');
    if (blueprint.version !== '1.0.0') throw new Error('Blueprint version mismatch');
    if (blueprint.status !== 'draft') throw new Error('Initial status should be draft');
  });

  suite.addTest('ValidationResult contract validation', () => {
    const result = new ValidationResult({
      blueprintId: 'pb-test'
    });

    if (!result.id.startsWith('vres-')) throw new Error('Result ID should start with vres-');
    if (result.blueprintId !== 'pb-test') throw new Error('Blueprint ID mismatch');
    if (result.status !== 'pending') throw new Error('Initial status should be pending');
  });

  suite.addTest('ArchitectureInspection contract validation', () => {
    const inspection = new ArchitectureInspection({
      blueprintId: 'pb-test'
    });

    if (!inspection.id.startsWith('insp-')) throw new Error('Inspection ID should start with insp-');
    if (inspection.blueprintId !== 'pb-test') throw new Error('Blueprint ID mismatch');
  });

  // ========== Status Lifecycle Tests ==========

  suite.addTest('ComponentDefinition status transitions', () => {
    const component = new ComponentDefinition({
      name: 'Test',
      type: 'engine'
    });

    if (component.status_lifecycle !== 'draft') throw new Error('Initial status should be draft');

    component.markDefined();
    if (component.status_lifecycle !== 'defined') throw new Error('Status should be defined');

    component.markValidated();
    if (component.status_lifecycle !== 'validated') throw new Error('Status should be validated');

    component.markApproved();
    if (component.status_lifecycle !== 'approved') throw new Error('Status should be approved');
  });

  suite.addTest('RelationshipDefinition status transitions', () => {
    const rel = new RelationshipDefinition({
      source: 'C1',
      target: 'C2',
      type: 'dependency'
    });

    rel.markDefined().markValidated().markApproved();
    if (rel.status !== 'approved') throw new Error('Should transition through lifecycle');
  });

  suite.addTest('PlatformBlueprint status transitions', () => {
    const blueprint = new PlatformBlueprint({
      name: 'Test',
      version: '1.0.0'
    });

    blueprint.markDefined();
    if (blueprint.status !== 'defined') throw new Error('Status should be defined');
  });

  // ========== Serialization Tests ==========

  suite.addTest('ComponentDefinition serialization', () => {
    const component = new ComponentDefinition({
      name: 'TestComp',
      type: 'engine',
      capabilities: ['test']
    });

    const json = component.toJSON();
    if (!json.id) throw new Error('Serialized object missing id');
    if (json.name !== 'TestComp') throw new Error('Serialized name mismatch');
    if (!Array.isArray(json.capabilities)) throw new Error('Capabilities should be array');
  });

  suite.addTest('RelationshipDefinition serialization', () => {
    const rel = new RelationshipDefinition({
      source: 'A',
      target: 'B',
      type: 'dependency'
    });

    const json = rel.toJSON();
    if (json.source !== 'A') throw new Error('Source mismatch in serialization');
    if (json.target !== 'B') throw new Error('Target mismatch in serialization');
  });

  suite.addTest('PlatformBlueprint serialization', () => {
    const blueprint = new PlatformBlueprint({
      name: 'TestBlueprint',
      version: '2.0.0'
    });

    const comp = new ComponentDefinition({ name: 'Comp1', type: 'runtime' });
    blueprint.addComponent(comp);

    const json = blueprint.toJSON();
    if (json.components.length !== 1) throw new Error('Components should be serialized');
    if (json.components[0].name !== 'Comp1') throw new Error('Component name mismatch in serialization');
  });

  // ========== Blueprint Population Tests ==========

  suite.addTest('Genesis platform blueprint creation', () => {
    const blueprint = createGenesisPlatformBlueprint();

    if (!blueprint.components || blueprint.components.length === 0) {
      throw new Error('Blueprint should have components');
    }
    if (!blueprint.relationships || blueprint.relationships.length === 0) {
      throw new Error('Blueprint should have relationships');
    }
    if (!blueprint.validationRules || blueprint.validationRules.length === 0) {
      throw new Error('Blueprint should have validation rules');
    }
  });

  suite.addTest('Genesis blueprint has core components', () => {
    const blueprint = createGenesisPlatformBlueprint();

    const expectedComponents = [
      'RuntimeEngine', 'BusinessCompiler', 'KnowledgeGraph',
      'DigitalTwin', 'LearningEngine', 'EvolutionEngine'
    ];

    for (const expected of expectedComponents) {
      const found = blueprint.getComponent(expected);
      if (!found) throw new Error(`Expected component ${expected} not found`);
    }
  });

  suite.addTest('Genesis blueprint has valid relationships', () => {
    const blueprint = createGenesisPlatformBlueprint();

    for (const rel of blueprint.relationships) {
      if (!rel.source) throw new Error('Relationship missing source');
      if (!rel.target) throw new Error('Relationship missing target');
      if (!rel.type) throw new Error('Relationship missing type');
    }
  });

  suite.addTest('Blueprint getComponentsByType filtering', () => {
    const blueprint = createGenesisPlatformBlueprint();

    const compilers = blueprint.getComponentsByType('compiler');
    if (compilers.length === 0) throw new Error('Should find compiler components');

    const engines = blueprint.getComponentsByType('engine');
    if (engines.length === 0) throw new Error('Should find engine components');

    for (const compiler of compilers) {
      if (compiler.type !== 'compiler') throw new Error('Type filter failed');
    }
  });

  suite.addTest('Blueprint getComponent by name', () => {
    const blueprint = createGenesisPlatformBlueprint();

    const runtime = blueprint.getComponent('RuntimeEngine');
    if (!runtime) throw new Error('Should find RuntimeEngine');
    if (runtime.name !== 'RuntimeEngine') throw new Error('Component name mismatch');
  });

  // ========== Validator Tests ==========

  suite.addTest('GenesisPlatformValidator initialization', async () => {
    const validator = new GenesisPlatformValidator();

    if (!validator.blueprint) throw new Error('Validator should have blueprint');
    if (!validator.blueprint.components || validator.blueprint.components.length === 0) {
      throw new Error('Validator blueprint should have components');
    }
  });

  suite.addTest('GenesisPlatformValidator full validation', async () => {
    const validator = new GenesisPlatformValidator();
    const result = await validator.validatePlatform();

    if (!result) throw new Error('Validation should return result');
    if (!result.status) throw new Error('Result should have status');
    if (result.validatedComponents.length === 0) throw new Error('Should validate components');
  });

  suite.addTest('GenesisPlatformValidator statistics', async () => {
    const validator = new GenesisPlatformValidator();
    await validator.validatePlatform();
    const stats = validator.getStats();

    if (stats.isValid === undefined) throw new Error('Stats should have isValid');
    if (stats.errorCount === undefined) throw new Error('Stats should have errorCount');
    if (stats.warningCount === undefined) throw new Error('Stats should have warningCount');
    if (stats.duration === undefined) throw new Error('Stats should have duration');
  });

  suite.addTest('ValidationResult error tracking', () => {
    const result = new ValidationResult({ blueprintId: 'test' });

    result.addError('Test error');
    if (result.errors.length !== 1) throw new Error('Error count mismatch');
    if (result.status !== 'invalid') throw new Error('Status should be invalid');
  });

  suite.addTest('ValidationResult warning tracking', () => {
    const result = new ValidationResult({ blueprintId: 'test' });

    result.addWarning('Test warning');
    if (result.warnings.length !== 1) throw new Error('Warning count mismatch');
    if (result.status !== 'warnings') throw new Error('Status should be warnings');
  });

  suite.addTest('ValidationResult isValid check', () => {
    const result = new ValidationResult({ blueprintId: 'test' });

    result.markValid();
    if (!result.isValid()) throw new Error('Should be valid');

    result.addError('Error');
    if (result.isValid()) throw new Error('Should not be valid after error');
  });

  // ========== Inspector Tests ==========

  suite.addTest('GenesisPlatformInspector initialization', async () => {
    const inspector = new GenesisPlatformInspector();

    if (!inspector.blueprint) throw new Error('Inspector should have blueprint');
  });

  suite.addTest('GenesisPlatformInspector full inspection', async () => {
    const inspector = new GenesisPlatformInspector();
    const inspection = await inspector.inspectArchitecture();

    if (!inspection) throw new Error('Inspection should return result');
    if (inspection.componentCount === 0) throw new Error('Should count components');
    if (inspection.relationshipCount === 0) throw new Error('Should count relationships');
  });

  suite.addTest('Inspector component status', async () => {
    const inspector = new GenesisPlatformInspector();
    const inspection = await inspector.inspectArchitecture();

    if (Object.keys(inspection.components).length === 0) {
      throw new Error('Should have component status entries');
    }

    for (const [name, status] of Object.entries(inspection.components)) {
      if (!status.name) throw new Error('Status should have name');
      if (!status.type) throw new Error('Status should have type');
    }
  });

  suite.addTest('Inspector metrics calculation', async () => {
    const inspector = new GenesisPlatformInspector();
    const inspection = await inspector.inspectArchitecture();

    if (!inspection.metrics) throw new Error('Should have metrics');
    if (inspection.metrics.componentsByType === undefined) throw new Error('Should have componentsByType');
    if (inspection.metrics.averageDependenciesPerComponent === undefined) {
      throw new Error('Should have averageDependenciesPerComponent');
    }
  });

  suite.addTest('Inspector health determination', async () => {
    const inspector = new GenesisPlatformInspector();
    const inspection = await inspector.inspectArchitecture();

    const validStates = ['healthy', 'degraded', 'critical', 'unknown'];
    if (!validStates.includes(inspection.health)) throw new Error('Invalid health state');
  });

  suite.addTest('Inspector get component info', async () => {
    const inspector = new GenesisPlatformInspector();
    const info = inspector.getComponentInfo('RuntimeEngine');

    if (!info) throw new Error('Should find RuntimeEngine');
    if (!info.component) throw new Error('Should have component');
    if (!Array.isArray(info.incomingRelationships)) throw new Error('Should have relationships');
  });

  suite.addTest('Inspector get architecture layers', async () => {
    const inspector = new GenesisPlatformInspector();
    const layers = inspector.getArchitectureLayers();

    if (!layers.runtime) throw new Error('Should have runtime layer');
    if (!layers.compilers) throw new Error('Should have compilers layer');
    if (!layers.engines) throw new Error('Should have engines layer');
    if (!layers.infrastructure) throw new Error('Should have infrastructure layer');
  });

  suite.addTest('Inspector get compilation pipeline', async () => {
    const inspector = new GenesisPlatformInspector();
    const pipeline = inspector.getCompilationPipeline();

    if (!pipeline.compilers) throw new Error('Should have compilers');
    if (!Array.isArray(pipeline.flow)) throw new Error('Pipeline flow should be array');
  });

  // ========== Integration Tests ==========

  suite.addTest('Blueprint blueprint->validation->inspection flow', async () => {
    const blueprint = createGenesisPlatformBlueprint();
    if (blueprint.components.length === 0) throw new Error('Blueprint should have components');

    const validator = new GenesisPlatformValidator();
    const result = await validator.validatePlatform();
    if (!result) throw new Error('Validation should succeed');

    const inspector = new GenesisPlatformInspector();
    const inspection = await inspector.inspectArchitecture();
    if (!inspection) throw new Error('Inspection should succeed');
  });

  suite.addTest('Blueprint component additions', () => {
    const blueprint = new PlatformBlueprint({
      name: 'Test',
      version: '1.0.0'
    });

    const initialCount = blueprint.components.length;
    const comp = new ComponentDefinition({ name: 'NewComp', type: 'engine' });
    blueprint.addComponent(comp);

    if (blueprint.components.length !== initialCount + 1) throw new Error('Component should be added');
  });

  suite.addTest('Blueprint relationship additions', () => {
    const blueprint = new PlatformBlueprint({
      name: 'Test',
      version: '1.0.0'
    });

    const rel = new RelationshipDefinition({
      source: 'A',
      target: 'B',
      type: 'dependency'
    });
    blueprint.addRelationship(rel);

    if (blueprint.relationships.length !== 1) throw new Error('Relationship should be added');
  });

  suite.addTest('Full architecture serialization', async () => {
    const blueprint = createGenesisPlatformBlueprint();
    const json = blueprint.toJSON();

    if (!json.components || !Array.isArray(json.components)) throw new Error('Components should be serialized');
    if (!json.relationships || !Array.isArray(json.relationships)) throw new Error('Relationships should be serialized');
    if (json.components.length === 0) throw new Error('Should have serialized components');
  });

  suite.addTest('Validator generates report', async () => {
    const validator = new GenesisPlatformValidator();
    await validator.validatePlatform();
    const report = validator.generateReport('text');

    if (!report || typeof report !== 'string') throw new Error('Report should be string');
    if (report.length === 0) throw new Error('Report should not be empty');
  });

  suite.addTest('Inspector generates report', async () => {
    const inspector = new GenesisPlatformInspector();
    await inspector.inspectArchitecture();
    const report = inspector.generateReport('text');

    if (!report || typeof report !== 'string') throw new Error('Report should be string');
    if (report.length === 0) throw new Error('Report should not be empty');
  });

  return suite;
}

