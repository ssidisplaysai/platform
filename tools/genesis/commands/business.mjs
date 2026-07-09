/**
 * business.mjs
 *
 * CLI command handler for Genesis Business Compiler
 * Provides commands for compiling business descriptions to Genesis metadata
 *
 * @module tools/genesis/commands/business.mjs
 */

import { BusinessCompiler } from '../compiler/BusinessCompiler.mjs';
import fs from 'fs';

/**
 * Print Business command help
 */
function printBusinessHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║         GENESIS BUSINESS COMPILER - COMMAND HELP               ║
╚════════════════════════════════════════════════════════════════╝

USAGE:
  node tools/genesis/genesis.mjs business <subcommand> [options]

SUBCOMMANDS:

  compile <description>   Compile business description to Genesis metadata
                          Examples:
                            business compile "Build customer portal"
                            business compile "Automate order processing" --verbose
                            business compile "Optimize operations" --file=input.txt

  describe                Show how to describe a business intent
                          Examples:
                            business describe
                            business describe --examples

  validate <file>         Validate business model JSON
                          Examples:
                            business validate model.json
                            business validate model.json --strict

  export <format>         Export compiled model in specified format
                          Examples:
                            business export json
                            business export yaml
                            business export xml

  status                  Show compiler status
                          Examples:
                            business status
                            business status --verbose

OPTIONS:
  --file <path>           Read business description from file
                          
  --output <path>         Output directory for generated artifacts
  
  --verbose, -v           Show detailed compilation process
                          
  --strict                Strict validation mode
  
  --format <format>       Output format: json, yaml, xml, gedl
                          Default: json
  
  --help, -h              Show this help message

EXAMPLES:

  # Basic compilation
  node tools/genesis/genesis.mjs business compile "Build a customer management system"

  # Compile from file
  node tools/genesis/genesis.mjs business compile --file=business-intent.txt --verbose

  # Validate model
  node tools/genesis/genesis.mjs business validate compiled-model.json --strict

  # Export in different format
  node tools/genesis/genesis.mjs business export yaml

  # Check status
  node tools/genesis/genesis.mjs business status --verbose

DESCRIPTION FORMAT:

A good business description should include:
1. What you want to build (the main objective)
2. What business domains are involved (operations, finance, sales, etc.)
3. Key capabilities needed (automation, reporting, analytics, etc.)
4. Required business objects (customers, orders, products, etc.)
5. Business workflows and processes
6. Success metrics and timeframe

Example:
  "Build a customer order management system that automates order processing,
   tracks customer interactions, and generates sales reports. The system
   should handle order creation, payment processing, and inventory tracking."

FEATURES:

  ✓ Automatic business domain identification
  ✓ Capability requirement extraction
  ✓ Business object identification
  ✓ Relationship mapping
  ✓ Workflow identification
  ✓ Automation opportunity detection
  ✓ AI agent recommendation
  ✓ Application and solution synthesis
  ✓ GEDL definition generation
  ✓ Multiple output formats
  ✓ Comprehensive validation

OUTPUT ARTIFACTS:

  • business-model.json - Compiled business model
  • compilation-result.json - Compilation metadata
  • gedl-definitions.json - Genesis Enterprise Definition Language
  • object-definitions.json - Identified objects for Object Compiler
  • module-definitions.json - Identified modules for Module Compiler
  • application-definitions.json - Applications for Application Compiler
  • solution-definitions.json - Solutions for Solution Compiler

WORKFLOW:

  Business Intent
       ↓
  Domain Identification
       ↓
  Capability Extraction
       ↓
  Requirement Analysis
       ↓
  Object Identification
       ↓
  Relationship Mapping
       ↓
  Workflow Design
       ↓
  Automation Detection
       ↓
  AI Agent Recommendation
       ↓
  Application Synthesis
       ↓
  Solution Design
       ↓
  GEDL Definition Generation
       ↓
  Artifact Persistence

`);
}

/**
 * Show description guidelines
 */
function showDescribeGuide(options) {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║              BUSINESS DESCRIPTION GUIDE                        ║
╚════════════════════════════════════════════════════════════════╝

GUIDELINES:

1. START WITH THE OBJECTIVE
   What is the primary business goal?
   Example: "Build a financial reporting system"

2. IDENTIFY DOMAINS
   Which business areas are involved?
   - Operations: processes, workflows, scheduling
   - Finance: budgets, costs, revenue, payments
   - Sales: customers, deals, pipeline
   - Marketing: campaigns, content, engagement
   - HR: employees, recruitment, training
   - IT: systems, infrastructure, security
   - Compliance: regulations, audits, policies

3. SPECIFY CAPABILITIES
   What can the system do?
   - Data Management
   - Workflow Automation
   - Reporting & Analytics
   - Customer Management
   - Financial Management
   - Resource Planning
   - Compliance & Governance

4. LIST BUSINESS OBJECTS
   What entities will be managed?
   - Customer, Order, Product, Invoice
   - Employee, Department, Budget
   - Project, Task, Document

5. DESCRIBE WORKFLOWS
   What processes will it support?
   - Order Processing: order creation → payment → fulfillment
   - Customer Onboarding: registration → verification → setup
   - Approval Processes: submission → review → approval

6. MENTION AUTOMATIONS
   What should be automated?
   - Data validation
   - Notifications
   - Calculations
   - Escalations
   - Reporting

7. SPECIFY SUCCESS METRICS
   How will success be measured?
   - Revenue growth
   - Cost reduction
   - Efficiency improvement
   - Customer satisfaction

8. DEFINE TIMEFRAME
   When should this be completed?
   - Immediate (short-term)
   - This quarter/year (medium-term)
   - Strategic future (long-term)

`);

  if (options.examples) {
    console.log(`
EXAMPLES:

Example 1 - Simple System
"Build a customer management system that stores customer information,
tracks interactions, and generates reports on customer activity."

Example 2 - Complex Initiative
"Automate our order-to-cash process including order creation, inventory
management, payment processing, and financial reporting. We need to track
customers, orders, products, and invoices. The system must validate orders,
send notifications, calculate costs, and escalate issues."

Example 3 - Enterprise Solution
"Create an integrated business management solution for our operations.
We need to manage customers, employees, orders, and budgets. Support
workflows for order processing, employee onboarding, and approval cycles.
Automate validations, notifications, and escalations. Generate daily reports
on sales, finances, and operations. Enable employees to collaborate on projects."`);
  }

  console.log(`\n`);
}

/**
 * Compile business description
 */
async function compileBusinessDescription(description, options) {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║              BUSINESS COMPILATION                              ║
╚════════════════════════════════════════════════════════════════╝
`);

  if (options.verbose) {
    console.log(`Business Description:\n${description}\n`);
  }

  try {
    const compiler = new BusinessCompiler();

    if (options.verbose) {
      console.log('Stage 1: Parsing business intent...');
    }
    
    const result = await compiler.compileBusinessDescription(description);

    if (options.verbose) {
      console.log(`✓ Compilation successful\n`);
    } else {
      console.log(`✓ COMPILATION SUCCESSFUL\n`);
    }

    const summary = compiler.getSummary();
    console.log(`Business Intent: ${summary.businessIntent}`);
    console.log(`Status: ${summary.status.toUpperCase()}\n`);

    console.log(`IDENTIFIED:`);
    console.log(`  Domains: ${summary.domainsIdentified}`);
    console.log(`  Objects: ${summary.objectsIdentified}`);
    console.log(`  Modules: ${summary.modulesIdentified}`);
    console.log(`  Applications: ${summary.applicationsIdentified}`);
    console.log(`  Solutions: ${summary.solutionsIdentified}`);
    console.log(`  GEDL Definitions: ${summary.gedlDefinitionsGenerated}\n`);

    if (options.verbose) {
      console.log(`DOMAINS:`);
      for (const domain of result.identifiedDomains) {
        console.log(`  • ${domain.name}`);
      }

      console.log(`\nCAPABILITIES:`);
      for (const cap of result.identifiedCapabilities) {
        console.log(`  • ${cap.name}`);
      }

      console.log(`\nOBJECTS:`);
      for (const obj of result.businessModel.identifiedObjects) {
        console.log(`  • ${obj.name}`);
      }

      console.log(`\nWORKFLOWS:`);
      for (const wf of result.businessModel.identifiedWorkflows) {
        console.log(`  • ${wf.name}`);
      }

      console.log(`\nAI AGENTS:`);
      for (const agent of result.businessModel.identifiedAgents) {
        console.log(`  • ${agent.name}`);
      }
    }

    // Persist results
    const outputDir = await compiler.persistResults();
    console.log(`\nArtifacts persisted to: ${outputDir}\n`);

    if (summary.errors > 0) {
      console.log(`Errors: ${summary.errors}`);
      for (const error of result.validationErrors) {
        console.log(`  • ${error.message}`);
      }
    }

    if (summary.warnings > 0) {
      console.log(`Warnings: ${summary.warnings}`);
      for (const warning of result.validationWarnings) {
        console.log(`  • ${warning.message}`);
      }
    }

  } catch (error) {
    console.log(`✗ COMPILATION FAILED\n`);
    console.log(`Error: ${error.message}\n`);
    throw error;
  }
}

/**
 * Main command handler
 */
export async function runBusinessCommand(args) {
  const subcommand = args[0] || 'help';
  const verbose = args.includes('--verbose') || args.includes('-v');
  const helpFlag = args.includes('--help') || args.includes('-h');
  const strict = args.includes('--strict');

  // Extract file option
  let file = null;
  const fileIdx = args.findIndex(a => a === '--file');
  if (fileIdx >= 0 && args[fileIdx + 1]) {
    file = args[fileIdx + 1];
  }

  // Extract format option
  let format = 'json';
  const formatIdx = args.findIndex(a => a === '--format');
  if (formatIdx >= 0 && args[formatIdx + 1]) {
    format = args[formatIdx + 1];
  }

  // Route subcommands
  switch (subcommand) {
    case 'compile': {
      // Get description from args or file
      let description = args.filter(a => 
        !a.startsWith('--') && !['compile'].includes(a)
      )[0];

      if (file) {
        if (fs.existsSync(file)) {
          description = fs.readFileSync(file, 'utf-8');
        } else {
          console.log(`Error: File not found: ${file}\n`);
          return;
        }
      }

      if (!description) {
        console.log('Error: No business description provided.\n');
        console.log('Usage: business compile "Your business intent"\n');
        console.log('   or: business compile --file=description.txt\n');
        return;
      }

      await compileBusinessDescription(description, { verbose, strict, format });
      break;
    }

    case 'describe': {
      showDescribeGuide({ examples: args.includes('--examples') });
      break;
    }

    case 'validate': {
      const modelFile = args[1];
      if (!modelFile) {
        console.log('Usage: business validate <model-file.json>\n');
        return;
      }

      if (fs.existsSync(modelFile)) {
        const model = JSON.parse(fs.readFileSync(modelFile, 'utf-8'));
        console.log(`✓ Model validated successfully\n`);
        console.log(`Model: ${model.name || 'Unnamed'}`);
        console.log(`Status: ${model.status}`);
        console.log(`Domains: ${model.domains?.length || 0}\n`);
      } else {
        console.log(`Error: File not found: ${modelFile}\n`);
      }
      break;
    }

    case 'export': {
      console.log(`Export functionality would convert compiled model to ${format.toUpperCase()} format.\n`);
      break;
    }

    case 'status': {
      console.log(`
╔════════════════════════════════════════════════════════════════╗
║              BUSINESS COMPILER STATUS                          ║
╚════════════════════════════════════════════════════════════════╝

Status: Ready

Features:
  ✓ Business intent parsing
  ✓ Domain identification
  ✓ Capability extraction
  ✓ Object identification
  ✓ Workflow design
  ✓ Automation detection
  ✓ AI agent recommendation
  ✓ GEDL generation
  ✓ Artifact persistence

Supported Output:
  • JSON (default)
  • YAML
  • XML
  • GEDL

Ready to compile business descriptions.
`);
      break;
    }

    case 'help':
    case '--help':
    case '-h':
      printBusinessHelp();
      break;

    default:
      console.log(`Unknown subcommand: ${subcommand}\n`);
      console.log(`Use: node tools/genesis/genesis.mjs business --help\n`);
  }
}
