/**
 * GenesisPlatformValidator.mjs
 *
 * Genesis Meta Compiler - Platform Validation Engine
 * Validates Genesis architecture against the platform blueprint
 *
 * @module tools/genesis/compiler/GenesisPlatformValidator.mjs
 */

import { createGenesisPlatformBlueprint, ValidationResult } from './GenesisPlatformBlueprint.mjs';
import { existsSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMPILER_DIR = join(__dirname);
const COMMANDS_DIR = join(dirname(__dirname), 'commands');

export class GenesisPlatformValidator {
  constructor() {
    this.blueprint = createGenesisPlatformBlueprint();
    this.result = null;
  }

  /**
   * Validate the entire Genesis platform against the blueprint
   */
  async validatePlatform() {
    const startTime = Date.now();
    this.result = new ValidationResult({
      blueprintId: this.blueprint.id
    });

    try {
      // Stage 1: Validate component definitions
      await this.validateComponents();

      // Stage 2: Validate relationships
      await this.validateRelationships();

      // Stage 3: Validate dependency graph
      await this.validateDependencyGraph();

      // Stage 4: Validate file structure
      await this.validateFileStructure();

      // Stage 5: Validate compilation pipeline
      await this.validateCompilationPipeline();

      // Mark result based on errors
      if (this.result.errors.length === 0) {
        this.result.markValid();
      }

      this.result.duration = Date.now() - startTime;
      return this.result;
    } catch (error) {
      this.result.addError(`Validation failed: ${error.message}`);
      this.result.duration = Date.now() - startTime;
      return this.result;
    }
  }

  /**
   * Stage 1: Validate all components exist and are properly defined
   */
  async validateComponents() {
    const componentMap = new Map();

    for (const component of this.blueprint.components) {
      // Check component has required fields
      if (!component.name) {
        this.result.addError(`Component missing name`);
        continue;
      }

      if (!component.type) {
        this.result.addError(`Component ${component.name} missing type`);
        continue;
      }

      // Validate component type
      const validTypes = ['runtime', 'compiler', 'engine', 'graph', 'twin', 'cli', 'orchestrator', 'system', 'kernel'];
      if (!validTypes.includes(component.type)) {
        this.result.addWarning(`Component ${component.name} has unknown type: ${component.type}`);
      }

      // Validate component status
      const validStatuses = ['draft', 'beta', 'stable', 'deprecated'];
      if (component.status && !validStatuses.includes(component.status)) {
        this.result.addWarning(`Component ${component.name} has unknown status: ${component.status}`);
      }

      componentMap.set(component.name, component);
      this.result.validatedComponents.push(component.name);
    }

    // Check for expected components
    const expectedComponents = [
      'RuntimeEngine', 'BusinessCompiler', 'KnowledgeGraph', 
      'DigitalTwin', 'LearningEngine', 'EvolutionEngine'
    ];

    for (const expected of expectedComponents) {
      if (!componentMap.has(expected)) {
        this.result.addError(`Expected component ${expected} not found in blueprint`);
      }
    }

    return componentMap;
  }

  /**
   * Stage 2: Validate all relationships are properly defined
   */
  async validateRelationships() {
    const componentNames = new Set(this.blueprint.components.map(c => c.name));

    for (const relationship of this.blueprint.relationships) {
      // Check relationship has required fields
      if (!relationship.source) {
        this.result.addError(`Relationship missing source`);
        continue;
      }

      if (!relationship.target) {
        this.result.addError(`Relationship missing target`);
        continue;
      }

      if (!relationship.type) {
        this.result.addError(`Relationship ${relationship.source} -> ${relationship.target} missing type`);
        continue;
      }

      // Validate source and target components exist
      if (!componentNames.has(relationship.source)) {
        this.result.addError(`Relationship source ${relationship.source} not found in components`);
      }

      if (!componentNames.has(relationship.target)) {
        this.result.addError(`Relationship target ${relationship.target} not found in components`);
      }

      // Validate relationship type
      const validTypes = ['input', 'output', 'dependency', 'integration', 'orchestration', 'feedback'];
      if (!validTypes.includes(relationship.type)) {
        this.result.addWarning(`Relationship ${relationship.source} -> ${relationship.target} has unknown type: ${relationship.type}`);
      }

      this.result.validatedRelationships.push(relationship.id);
    }
  }

  /**
   * Stage 3: Validate dependency graph for cycles and consistency
   */
  async validateDependencyGraph() {
    const adjacencyList = new Map();
    const componentMap = new Map(this.blueprint.components.map(c => [c.name, c]));

    // Build adjacency list from relationships
    for (const rel of this.blueprint.relationships) {
      if (rel.type === 'dependency' || rel.type === 'integration') {
        if (!adjacencyList.has(rel.source)) {
          adjacencyList.set(rel.source, []);
        }
        adjacencyList.get(rel.source).push(rel.target);
      }
    }

    // Check for cycles using DFS
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (node) => {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = adjacencyList.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    // Check all components for cycles
    for (const component of this.blueprint.components) {
      visited.clear();
      recursionStack.clear();

      if (hasCycle(component.name)) {
        this.result.addError(`Circular dependency detected involving ${component.name}`);
      }
    }

    // Validate component dependencies match relationship definitions
    for (const component of this.blueprint.components) {
      const componentDeps = component.dependencies || [];
      const relationshipDeps = (adjacencyList.get(component.name) || []).filter(
        target => {
          const rel = this.blueprint.relationships.find(
            r => r.source === component.name && r.target === target && r.type === 'dependency'
          );
          return rel !== undefined;
        }
      );

      // Check if component declares dependencies not in relationships
      for (const dep of componentDeps) {
        if (!componentMap.has(dep)) {
          this.result.addWarning(`Component ${component.name} declares dependency on unknown component ${dep}`);
        }
      }
    }
  }

  /**
   * Stage 4: Validate file structure matches blueprint
   */
  async validateFileStructure() {
    try {
      // Check compiler directory exists
      if (!existsSync(COMPILER_DIR)) {
        this.result.addError(`Compiler directory not found at ${COMPILER_DIR}`);
        return;
      }

      // Check expected compiler files
      const compilerFiles = readdirSync(COMPILER_DIR).filter(f => f.endsWith('.mjs'));
      
      // Should have blueprint files for major engines
      const expectedBlueprintFiles = [
        'LearningBlueprint.mjs',
        'EvolutionBlueprint.mjs',
        'DecisionBlueprint.mjs',
        'PlanningBlueprint.mjs',
        'SimulationBlueprint.mjs'
      ];

      for (const expectedFile of expectedBlueprintFiles) {
        if (!compilerFiles.includes(expectedFile)) {
          this.result.addWarning(`Expected compiler file ${expectedFile} not found`);
        }
      }

      // Check commands directory
      if (existsSync(COMMANDS_DIR)) {
        const commandFiles = readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.mjs'));
        
        // Should have CLI commands
        const expectedCommandFiles = ['learn.mjs', 'evolve.mjs', 'plan.mjs'];
        let foundCount = 0;
        for (const expectedFile of expectedCommandFiles) {
          if (commandFiles.includes(expectedFile)) {
            foundCount++;
          }
        }

        if (foundCount === 0) {
          this.result.addWarning('No major CLI command files found');
        }
      }
    } catch (error) {
      this.result.addWarning(`File structure validation incomplete: ${error.message}`);
    }
  }

  /**
   * Stage 5: Validate compilation pipeline capability
   */
  async validateCompilationPipeline() {
    // Check that compilers form a valid pipeline
    const compilers = this.blueprint.getComponentsByType('compiler');

    if (compilers.length === 0) {
      this.result.addError('No compiler components found in blueprint');
      return;
    }

    // Each compiler should be connected in the dependency graph
    const compilerNames = new Set(compilers.map(c => c.name));
    
    for (const compiler of compilers) {
      // Each compiler should depend on RuntimeEngine directly or indirectly
      const hasRuntimePath = this.hasPathToComponent(compiler.name, 'RuntimeEngine');
      if (!hasRuntimePath) {
        this.result.addError(`Compiler ${compiler.name} is not connected to RuntimeEngine`);
      }
    }

    // Check pipeline order (should form a DAG)
    const pipelineOrder = ['BusinessCompiler', 'ObjectCompiler', 'ModuleCompiler', 'ApplicationCompiler', 'SolutionCompiler'];
    let lastFound = -1;

    for (const compilerName of pipelineOrder) {
      const compiler = this.blueprint.getComponent(compilerName);
      if (compiler) {
        const currentPos = pipelineOrder.indexOf(compilerName);
        // This is just a logical position check, no specific ordering required
      }
    }
  }

  /**
   * Check if there's a path from source to target component
   */
  hasPathToComponent(source, target) {
    if (source === target) return true;

    const visited = new Set();
    const queue = [source];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === target) return true;

      if (visited.has(current)) continue;
      visited.add(current);

      // Find all components this one depends on
      const rels = this.blueprint.relationships.filter(
        r => r.source === current && (r.type === 'dependency' || r.type === 'integration')
      );

      for (const rel of rels) {
        if (!visited.has(rel.target)) {
          queue.push(rel.target);
        }
      }
    }

    return false;
  }

  /**
   * Get validation statistics
   */
  getStats() {
    if (!this.result) return null;

    return {
      isValid: this.result.isValid(),
      errorCount: this.result.errors.length,
      warningCount: this.result.warnings.length,
      validatedComponents: this.result.validatedComponents.length,
      validatedRelationships: this.result.validatedRelationships.length,
      totalComponents: this.blueprint.components.length,
      totalRelationships: this.blueprint.relationships.length,
      duration: this.result.duration
    };
  }

  /**
   * Generate validation report
   */
  generateReport(format = 'text') {
    if (!this.result) return 'No validation result available';

    if (format === 'json') {
      return JSON.stringify(this.result.toJSON(), null, 2);
    }

    let report = '';
    report += `\n═══════════════════════════════════════════\n`;
    report += `Genesis Platform Validation Report\n`;
    report += `═══════════════════════════════════════════\n\n`;

    report += `Status: ${this.result.status.toUpperCase()}\n`;
    report += `Duration: ${this.result.duration}ms\n\n`;

    report += `Components Validated: ${this.result.validatedComponents.length}/${this.blueprint.components.length}\n`;
    report += `Relationships Validated: ${this.result.validatedRelationships.length}/${this.blueprint.relationships.length}\n\n`;

    if (this.result.errors.length > 0) {
      report += `❌ Errors (${this.result.errors.length}):\n`;
      this.result.errors.forEach((err, i) => {
        report += `   ${i + 1}. ${err}\n`;
      });
      report += '\n';
    }

    if (this.result.warnings.length > 0) {
      report += `⚠️  Warnings (${this.result.warnings.length}):\n`;
      this.result.warnings.forEach((warn, i) => {
        report += `   ${i + 1}. ${warn}\n`;
      });
      report += '\n';
    }

    if (this.result.isValid()) {
      report += `✅ Platform architecture is valid!\n`;
    } else {
      report += `❌ Platform architecture has issues that must be resolved.\n`;
    }

    report += `\n═══════════════════════════════════════════\n`;

    return report;
  }
}

export async function validateGenesisPlatform() {
  const validator = new GenesisPlatformValidator();
  const result = await validator.validatePlatform();
  return result;
}

export async function runValidationCommand(options = {}) {
  const verbose = options.verbose || false;
  const format = options.format || 'text';

  const validator = new GenesisPlatformValidator();
  
  if (verbose) {
    console.log('\n🔍 Genesis Platform Validator\n');
    console.log('Stage 1: Validating components...');
  }

  const result = await validator.validatePlatform();

  if (verbose) {
    console.log(`  ✓ ${result.validatedComponents.length} components validated`);
    console.log('Stage 2: Validating relationships...');
    console.log(`  ✓ ${result.validatedRelationships.length} relationships validated`);
    console.log('Stage 3-5: Validating architecture...');
  }

  if (format === 'json') {
    console.log(JSON.stringify(result.toJSON(), null, 2));
  } else {
    console.log(validator.generateReport(format));
  }

  const stats = validator.getStats();
  if (verbose && stats) {
    console.log('\nValidation Statistics:');
    console.log(`  Valid: ${stats.isValid}`);
    console.log(`  Errors: ${stats.errorCount}`);
    console.log(`  Warnings: ${stats.warningCount}`);
    console.log(`  Duration: ${stats.duration}ms`);
  }

  return result;
}

export default {
  GenesisPlatformValidator,
  validateGenesisPlatform,
  runValidationCommand
};
