/**
 * partner.mjs
 *
 * Genesis Partner & QR Identity Engine CLI Commands
 * Handles partner metadata compilation, validation, and inspection
 *
 * @module tools/genesis/commands/partner.mjs
 */

import { PartnerQRIdentityValidator } from '../compiler/PartnerQRIdentityValidator.mjs';
import { PartnerQRIdentityInspector } from '../compiler/PartnerQRIdentityInspector.mjs';
import { createPartnerQRIdentityBlueprint } from '../compiler/PartnerQRIdentityBlueprint.mjs';

/**
 * Main partner command router
 */
export async function runPartnerCommand(args) {
  const [command, ...rest] = args;

  try {
    switch (command) {
      case 'validate':
        await handleValidateCommand(rest);
        break;
      case 'inspect':
        await handleInspectCommand(rest);
        break;
      case 'describe':
        await handleDescribeCommand(rest);
        break;
      case 'status':
        await handleStatusCommand(rest);
        break;
      case 'help':
        printPartnerHelp();
        break;
      default:
        console.log('Unknown partner command. Use: genesis partner help');
        break;
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Validate partner metadata
 */
async function handleValidateCommand(args) {
  const verbose = args.includes('--verbose') || args.includes('-v');
  const format = args.includes('--format=json') ? 'json' : 'text';

  const validator = new PartnerQRIdentityValidator();
  
  if (format === 'json') {
    const report = validator.generateReport('json');
    console.log(report);
  } else {
    const report = validator.generateReport('text');
    console.log(report);

    if (verbose) {
      const result = validator.validate();
      console.log('\nDETAILED STATISTICS:');
      console.log(`  Entities Validated: ${result.stats.entities_validated}`);
      console.log(`  Relationships Validated: ${result.stats.relationships_validated}`);
      console.log(`  Events Validated: ${result.stats.events_validated}`);
      console.log(`  Permissions Validated: ${result.stats.permissions_validated}`);
      console.log(`  Validation Rules: ${result.stats.rules_validated}`);
      console.log(`  Dashboard Contracts: ${result.stats.contracts_validated}`);
    }
  }
}

/**
 * Inspect partner architecture
 */
async function handleInspectCommand(args) {
  const verbose = args.includes('--verbose') || args.includes('-v');
  const format = args.includes('--format=json') ? 'json' : 'text';

  // Extract component name if specified
  let componentName = null;
  for (const arg of args) {
    if (arg.startsWith('--entity=')) {
      componentName = arg.replace('--entity=', '');
    }
  }

  const inspector = new PartnerQRIdentityInspector();

  if (componentName) {
    // Inspect specific entity
    const entityInfo = inspector.inspectEntity(componentName);
    if (entityInfo.error) {
      console.log(entityInfo.error);
    } else {
      console.log(`\nEntity: ${entityInfo.name}`);
      console.log(`Type: ${entityInfo.type}`);
      console.log(`Fields: ${entityInfo.fields_count}`);
      console.log(`Lifecycle Stages: ${entityInfo.lifecycle_stages.join(', ')}`);
      console.log(`Events Emitted: ${entityInfo.events_emitted.join(', ')}`);
      console.log(`Incoming Relationships: ${entityInfo.incoming_relationships.join(', ')}`);
      console.log(`Outgoing Relationships: ${entityInfo.outgoing_relationships.join(', ')}`);
    }
  } else {
    // Full inspection
    if (format === 'json') {
      const report = inspector.generateReport('json');
      console.log(report);
    } else {
      const report = inspector.generateReport('text');
      console.log(report);

      if (verbose) {
        const inspection = inspector.inspectArchitecture();
        
        console.log('\nCONVERSION FUNNEL:');
        const funnel = inspector.getConversionFunnel();
        console.log(`  ${funnel.funnel_path.join(' → ')}`);

        console.log('\nARCHITECTURE LAYERS:');
        const layers = inspector.getArchitectureLayers();
        console.log(`  Entity Types: ${Object.keys(layers).length}`);
      }
    }
  }
}

/**
 * Describe partner architecture
 */
async function handleDescribeCommand(args) {
  const format = args.includes('--format=json') ? 'json' : 'text';

  const blueprint = createPartnerQRIdentityBlueprint();

  if (format === 'json') {
    const json = blueprint.toJSON();
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log('╔═════════════════════════════════════════════════════════════════════╗');
    console.log('║  Partner & QR Identity Engine - Architecture Description           ║');
    console.log('╚═════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Name: ${blueprint.name}`);
    console.log(`Version: ${blueprint.version}`);
    console.log(`Description: ${blueprint.description}`);
    console.log('');

    console.log('CORE ENTITIES (10):');
    for (const entity of blueprint.entities) {
      console.log(`  • ${entity.name} - ${entity.entity_type}`);
      console.log(`    Fields: ${(entity.fields || []).length}`);
      console.log(`    Lifecycle: ${(entity.lifecycle_stages || []).join(', ')}`);
    }
    console.log('');

    console.log('RELATIONSHIPS (11):');
    for (const rel of blueprint.relationships) {
      console.log(`  • ${rel.source} → ${rel.target} (${rel.type}) [${rel.cardinality}]`);
    }
    console.log('');

    console.log('EVENTS (8):');
    for (const event of blueprint.events) {
      console.log(`  • ${event.name} (${event.aggregate})`);
    }
    console.log('');

    console.log('PERMISSIONS (4):');
    for (const perm of blueprint.permissions) {
      console.log(`  • ${perm.role}: ${(perm.actions || []).join(', ')}`);
    }
    console.log('');

    console.log('VALIDATION RULES (5):');
    for (const rule of blueprint.validation_rules) {
      console.log(`  • ${rule.name}`);
    }
    console.log('');

    console.log('DASHBOARD CONTRACTS (8):');
    for (const contract of blueprint.dashboard_contracts) {
      console.log(`  • ${contract.name} (${contract.contract_type})`);
    }
  }
}

/**
 * Show partner metadata status
 */
async function handleStatusCommand(args) {
  const verbose = args.includes('--verbose') || args.includes('-v');

  const validator = new PartnerQRIdentityValidator();
  const inspector = new PartnerQRIdentityInspector();

  const validationResult = validator.validate();
  const inspection = inspector.inspectArchitecture();

  console.log('╔═════════════════════════════════════════════════════════════════════╗');
  console.log('║  Partner & QR Identity Engine - Status                             ║');
  console.log('╚═════════════════════════════════════════════════════════════════════╝');
  console.log('');

  console.log('Partner Metadata Status:');
  console.log(`  Validation: ${validationResult.valid ? '✅ VALID' : '❌ INVALID'}`);
  console.log(`  Health: ${inspection.health_status}`);
  console.log(`  Health Score: ${inspection.health_percentage}%`);
  console.log('');

  console.log('Metadata Statistics:');
  console.log(`  Entities: ${validationResult.stats.entities_validated}`);
  console.log(`  Relationships: ${validationResult.stats.relationships_validated}`);
  console.log(`  Events: ${validationResult.stats.events_validated}`);
  console.log(`  Permissions: ${validationResult.stats.permissions_validated}`);
  console.log(`  Validation Rules: ${validationResult.stats.rules_validated}`);
  console.log(`  Dashboard Contracts: ${validationResult.stats.contracts_validated}`);
  console.log('');

  if (validationResult.errors.length > 0) {
    console.log('Validation Errors:');
    for (const error of validationResult.errors) {
      console.log(`  ✗ ${error}`);
    }
    console.log('');
  }

  if (verbose) {
    if (inspection.recommendations.length > 0) {
      console.log('Recommendations:');
      for (const rec of inspection.recommendations) {
        const icon = rec.severity === 'success' ? '✓' : rec.severity === 'warning' ? '⚠' : 'ℹ';
        console.log(`  ${icon} ${rec.message}`);
      }
      console.log('');
    }

    console.log('Entity Type Distribution:');
    const metrics = inspection.metrics;
    for (const [type, count] of Object.entries(metrics.entity_types || {})) {
      console.log(`  ${type}: ${count}`);
    }
  }
}

/**
 * Print help for partner commands
 */
function printPartnerHelp() {
  console.log('╔═════════════════════════════════════════════════════════════════════╗');
  console.log('║  Genesis Partner & QR Identity Engine v1 - CLI Commands            ║');
  console.log('╚═════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('USAGE: genesis partner <command> [options]');
  console.log('');
  console.log('COMMANDS:');
  console.log('');
  console.log('  validate          Validate partner metadata blueprint');
  console.log('  inspect           Inspect architecture and health');
  console.log('  describe          Describe architecture as metadata');
  console.log('  status            Show partner system status');
  console.log('  help              Show this help message');
  console.log('');

  console.log('OPTIONS:');
  console.log('  --verbose, -v     Show detailed output');
  console.log('  --format=json     Output in JSON format');
  console.log('  --entity=NAME     Inspect specific entity');
  console.log('');

  console.log('EXAMPLES:');
  console.log('');
  console.log('  # Validate partner metadata');
  console.log('  genesis partner validate');
  console.log('');
  console.log('  # Validate with verbose output');
  console.log('  genesis partner validate --verbose');
  console.log('');
  console.log('  # Inspect architecture health');
  console.log('  genesis partner inspect');
  console.log('');
  console.log('  # Inspect specific entity');
  console.log('  genesis partner inspect --entity=Partner');
  console.log('');
  console.log('  # Describe architecture as JSON');
  console.log('  genesis partner describe --format=json');
  console.log('');
  console.log('  # Show partner system status');
  console.log('  genesis partner status --verbose');
  console.log('');
  console.log('');
  console.log('ARCHITECTURE OVERVIEW:');
  console.log('');
  console.log('Core Path: QR Code → Referral → Lead → Sale → Attribution → Commission → Payout');
  console.log('');
  console.log('Entities:');
  console.log('  - Partner: Core partner entity');
  console.log('  - PartnerAccount: Financial account');
  console.log('  - PartnerQRCode: QR code for tracking');
  console.log('  - Campaign: Marketing campaign');
  console.log('  - ReferralEvent: QR scan/click event');
  console.log('  - LeadEvent: Lead generation event');
  console.log('  - SaleEvent: Sale event');
  console.log('  - AttributionRecord: Attribution calculation');
  console.log('  - CommissionRule: Commission calculation rules');
  console.log('  - PartnerPayout: Commission payout');
  console.log('');
}
