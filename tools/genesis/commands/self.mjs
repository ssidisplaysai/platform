/**
 * self.mjs
 *
 * Genesis Meta Compiler CLI Handler
 * Commands for Genesis self-validation and inspection
 *
 * @module tools/genesis/commands/self.mjs
 */

import { runValidationCommand } from '../compiler/GenesisPlatformValidator.mjs';
import { runInspectionCommand } from '../compiler/GenesisPlatformInspector.mjs';

/**
 * Route and handle self commands
 */
export async function runSelfCommand(args) {
  const [command, ...options] = args;

  // Parse options
  const opts = {
    verbose: options.includes('--verbose') || options.includes('-v'),
    format: 'text',
    component: null
  };

  // Check for format option
  const formatIdx = options.findIndex(o => o === '--format');
  if (formatIdx !== -1 && options[formatIdx + 1]) {
    opts.format = options[formatIdx + 1];
  }

  // Check for component option
  const componentIdx = options.findIndex(o => o === '--component');
  if (componentIdx !== -1 && options[componentIdx + 1]) {
    opts.component = options[componentIdx + 1];
  }

  // Handle help
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printSelfHelp();
    return;
  }

  try {
    switch (command) {
      case 'validate':
        await handleValidateCommand(opts);
        break;

      case 'inspect':
        await handleInspectCommand(opts);
        break;

      case 'describe':
        await handleDescribeCommand(opts);
        break;

      case 'status':
        await handleStatusCommand(opts);
        break;

      default:
        console.log(`Unknown self command: ${command}`);
        console.log('Use "genesis self --help" for available commands');
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error executing self ${command}:`, error.message);
    process.exit(1);
  }
}

/**
 * Handle validate command
 */
async function handleValidateCommand(opts) {
  console.log('\n🔍 Genesis Self-Validation\n');
  
  if (opts.verbose) {
    console.log('Initializing validation engine...');
  }

  await runValidationCommand(opts);
}

/**
 * Handle inspect command
 */
async function handleInspectCommand(opts) {
  console.log('\n🔎 Genesis Architecture Inspection\n');
  
  if (opts.verbose) {
    console.log('Initializing inspection engine...');
  }

  await runInspectionCommand(opts);
}

/**
 * Handle describe command - outputs architecture as metadata
 */
async function handleDescribeCommand(opts) {
  console.log('\n📋 Genesis Architecture Description\n');

  const { createGenesisPlatformBlueprint } = await import('../compiler/GenesisPlatformBlueprint.mjs');
  const blueprint = createGenesisPlatformBlueprint();

  if (opts.format === 'json') {
    console.log(JSON.stringify(blueprint.toJSON(), null, 2));
  } else {
    console.log('Platform Blueprint:');
    console.log(`  Name: ${blueprint.name}`);
    console.log(`  Version: ${blueprint.version}`);
    console.log(`  Status: ${blueprint.status}`);
    console.log(`  Components: ${blueprint.components.length}`);
    console.log(`  Relationships: ${blueprint.relationships.length}\n`);

    console.log('Components by Type:');
    const byType = {};
    blueprint.components.forEach(c => {
      byType[c.type] = (byType[c.type] || 0) + 1;
    });

    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  • ${type}: ${count}`);
    });

    console.log('\nComponents:');
    blueprint.components.forEach(c => {
      console.log(`  • ${c.name} (${c.type})`);
      console.log(`    Status: ${c.status}`);
      if (c.capabilities && c.capabilities.length > 0) {
        console.log(`    Capabilities: ${c.capabilities.join(', ')}`);
      }
      if (c.dependencies && c.dependencies.length > 0) {
        console.log(`    Dependencies: ${c.dependencies.join(', ')}`);
      }
    });
  }
}

/**
 * Handle status command
 */
async function handleStatusCommand(opts) {
  console.log('\n📊 Genesis Platform Status\n');

  const { GenesisPlatformValidator } = await import('../compiler/GenesisPlatformValidator.mjs');
  const validator = new GenesisPlatformValidator();
  const result = await validator.validatePlatform();
  const stats = validator.getStats();

  console.log('Self-Validation Results:');
  console.log(`  Status: ${result.status.toUpperCase()}`);
  console.log(`  Valid: ${stats.isValid ? '✅ YES' : '❌ NO'}`);
  console.log(`  Errors: ${stats.errorCount}`);
  console.log(`  Warnings: ${stats.warningCount}`);
  console.log(`  Duration: ${stats.duration}ms\n`);

  console.log('Component Summary:');
  console.log(`  Total: ${stats.totalComponents}`);
  console.log(`  Validated: ${stats.validatedComponents}\n`);

  console.log('Relationship Summary:');
  console.log(`  Total: ${stats.totalRelationships}`);
  console.log(`  Validated: ${stats.validatedRelationships}\n`);

  if (result.errors.length > 0) {
    console.log('❌ Errors:');
    result.errors.slice(0, 5).forEach(err => {
      console.log(`  • ${err}`);
    });
    if (result.errors.length > 5) {
      console.log(`  ... and ${result.errors.length - 5} more`);
    }
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    result.warnings.slice(0, 5).forEach(warn => {
      console.log(`  • ${warn}`);
    });
    if (result.warnings.length > 5) {
      console.log(`  ... and ${result.warnings.length - 5} more`);
    }
  }

  if (opts.verbose) {
    const { GenesisPlatformInspector } = await import('../compiler/GenesisPlatformInspector.mjs');
    const inspector = new GenesisPlatformInspector();
    const inspection = await inspector.inspectArchitecture();

    console.log('\nArchitecture Health:');
    console.log(`  Status: ${inspection.health.toUpperCase()}`);
    console.log(`  Summary: ${inspection.summary}`);
  }
}

/**
 * Print help for self commands
 */
function printSelfHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║              GENESIS SELF-COMPILATION COMMANDS                     ║
╚════════════════════════════════════════════════════════════════════╝

Genesis Meta Compiler v1 enables Genesis to describe, validate, and
inspect its own architecture using metadata-driven compilation.

COMMANDS:

  genesis self validate
    Validate Genesis architecture against the platform blueprint
    
    Options:
      --verbose, -v         Show detailed validation steps
      --format FORMAT       Output format: text (default), json
    
    Example:
      $ genesis self validate --verbose
      $ genesis self validate --format json

  genesis self inspect
    Inspect Genesis architecture and identify issues
    
    Options:
      --verbose, -v         Show detailed inspection steps
      --format FORMAT       Output format: text (default), json
      --component NAME      Inspect specific component
    
    Example:
      $ genesis self inspect
      $ genesis self inspect --component=RuntimeEngine
      $ genesis self inspect --format=json

  genesis self describe
    Output Genesis architecture as metadata
    
    Options:
      --format FORMAT       Output format: text (default), json
    
    Example:
      $ genesis self describe
      $ genesis self describe --format json

  genesis self status
    Show Genesis platform validation and health status
    
    Options:
      --verbose, -v         Show detailed inspection results
    
    Example:
      $ genesis self status
      $ genesis self status --verbose

  genesis self help
    Show this help message

DESCRIPTION:

Genesis Meta Compiler v1 introduces self-awareness to the platform:

1. Platform Blueprint
   - Defines Genesis components and relationships as metadata
   - Enables self-description and self-validation
   - Serves as contract for future changes

2. Self-Validation
   - Validates architecture against blueprint
   - Checks for circular dependencies
   - Ensures all required relationships exist
   - Validates file structure

3. Architecture Inspection
   - Analyzes component health and dependencies
   - Generates recommendations for improvements
   - Provides detailed component information
   - Maps architectural layers

4. Self-Compilation
   - Genesis can now compile its own architecture
   - Changes to architecture start as metadata
   - Compilation pipeline validates changes first
   - No invalid Genesis versions can be created

ARCHITECTURE LAYERS:

  Runtime Layer
    • RuntimeEngine - Executes compiled systems
    • EventBus - Manages event distribution

  Compilation Layer
    • BusinessCompiler - Compiles business definitions
    • ObjectCompiler - Compiles objects with inheritance
    • ModuleCompiler - Compiles module compositions
    • ApplicationCompiler - Compiles applications
    • SolutionCompiler - Compiles enterprise solutions

  Infrastructure Layer
    • KnowledgeGraph - Stores enterprise knowledge
    • DigitalTwin - Digital representation of systems
    • EventBus - Event management

  Analysis Layer
    • SimulationEngine - Simulates system behavior
    • PlanningEngine - Plans initiatives
    • DecisionEngine - Analyzes decisions
    • LearningEngine - Captures outcomes
    • EvolutionEngine - Proposes improvements

  Orchestration Layer
    • AIOrchestratorKernel - Coordinates AI capabilities

  Interface Layer
    • GenesisClI - Command-line interface
    • PackageSystem - Package management

DESIGN PRINCIPLES:

✓ Metadata-Driven
  - Architecture described in metadata, not code
  - Same compilation pipeline used for Genesis itself
  - Enables self-improvement and adaptation

✓ Self-Validating
  - Platform validates its own architecture
  - Cannot compile invalid versions of itself
  - All changes validated before deployment

✓ Self-Inspecting
  - Platform analyzes its own structure
  - Identifies bottlenecks and dependencies
  - Generates improvement recommendations

✓ Backwards Compatible
  - Existing implementations unchanged
  - Metadata introduced incrementally
  - Preserves current stability

INTEGRATION:

The platform blueprint integrates with:
  • Learning Engine - Analyzes Genesis behavior
  • Evolution Engine - Proposes architecture improvements
  • Planning Engine - Plans Genesis evolution
  • Simulation Engine - Models Genesis changes
  • Digital Twin - Represents Genesis architecture

WORKFLOW:

1. Propose architectural change as metadata
2. Run "genesis self validate" to check validity
3. Run "genesis self inspect" to analyze impact
4. Use Learning Engine to track outcomes
5. Use Evolution Engine to propose improvements
6. Compile updated architecture

SUCCESS CRITERIA:

✓ Genesis architecture can be described in metadata
✓ Self-validation succeeds
✓ Architecture inspection provides useful insights
✓ All components properly connected
✓ No circular dependencies
✓ Compilation pipeline functional

═══════════════════════════════════════════════════════════════════════

For more information, see:
  docs/architecture/0025-genesis-meta-compiler.md
  tools/genesis/compiler/GenesisPlatformBlueprint.mjs
  tools/genesis/compiler/GenesisPlatformValidator.mjs
  tools/genesis/compiler/GenesisPlatformInspector.mjs
`);
}

export default {
  runSelfCommand,
  printSelfHelp
};
