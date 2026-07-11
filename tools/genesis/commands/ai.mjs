/**
 * ai.mjs
 *
 * CLI command handler for Genesis AI Orchestrator
 * Provides commands for agent registration, orchestration, and execution
 *
 * @module tools/genesis/commands/ai.mjs
 */

import { AIOrchestratorKernel } from '../compiler/AIOrchestratorKernel.mjs';

/**
 * Print AI command help
 */
function printAIHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║         GENESIS AI ORCHESTRATOR - COMMAND HELP                 ║
╚════════════════════════════════════════════════════════════════╝

USAGE:
  node tools/genesis/genesis.mjs ai <subcommand> [options]

SUBCOMMANDS:

  orchestrate           Execute multi-agent orchestration
                        Examples:
                          ai orchestrate "Optimize operations"
                          ai orchestrate "Strategic planning" --priority=high
                          ai orchestrate "Financial analysis" --verbose

  agents                Manage agent registry
                        Examples:
                          ai agents list
                          ai agents register "New Agent" --domain=operations
                          ai agents status
                          ai agents summary

  execute               Execute orchestration with detailed output
                        Examples:
                          ai execute "Analyze performance"
                          ai execute --dry-run
                          ai execute "Risk assessment" --verbose

  status                Show orchestrator status
                        Examples:
                          ai status
                          ai status --agents
                          ai status --metrics

OPTIONS:
  --priority <level>    Request priority: low, normal, high, critical
                        Default: normal

  --domain <domain>     Focus domain: operations, finance, hr, it, sales,
                        customer, project, marketing, supply
                        Default: all

  --verbose, -v         Show detailed output including reasoning
                        
  --dry-run             Analysis mode - don't execute agents
  
  --agents              Show agent details with status

  --metrics             Show orchestrator metrics

  --help, -h            Show this help message

EXAMPLES:

  # Basic orchestration
  node tools/genesis/genesis.mjs ai orchestrate "Optimize supply chain"

  # High priority strategic planning
  node tools/genesis/genesis.mjs ai orchestrate "Strategic initiative" --priority=critical

  # Verbose execution with detailed reasoning
  node tools/genesis/genesis.mjs ai execute "Analyze market opportunity" --verbose

  # List all agents
  node tools/genesis/genesis.mjs ai agents list

  # Check orchestrator status with metrics
  node tools/genesis/genesis.mjs ai status --metrics

  # Dry run analysis
  node tools/genesis/genesis.mjs ai execute "Test workflow" --dry-run

FEATURES:

  ✓ Multi-agent orchestration with automatic agent selection
  ✓ Specialized agents for each domain (Operations, Finance, Strategy)
  ✓ Coordinator agents for cross-domain collaboration
  ✓ Transparent execution with detailed reasoning
  ✓ Planning, Decision, Simulation, and Runtime integration
  ✓ Automatic response merging and optimization
  ✓ Comprehensive execution history and metrics

`);
}

/**
 * Show orchestrator status
 */
function showStatus(kernel, options) {
  const summary = kernel.getSummary();
  
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║              ORCHESTRATOR STATUS                               ║
╚════════════════════════════════════════════════════════════════╝

Status: ${summary.status.toUpperCase()}
Agents: ${summary.agentsActive}/${summary.agents} active
Active Requests: ${summary.activeRequests}
Completed Requests: ${summary.completedRequests}
Execution History: ${summary.executionHistory}

`);

  if (options.agents) {
    console.log(`REGISTERED AGENTS:\n`);
    const agents = Array.from(kernel.agentRegistry.values());
    for (const agent of agents) {
      console.log(`  • ${agent.name}`);
      console.log(`    Role: ${agent.role}, Domain: ${agent.domain || 'general'}`);
      console.log(`    Status: ${agent.status}, Capabilities: ${agent.capabilities.length}\n`);
    }
  }

  if (options.metrics) {
    console.log(`METRICS:\n`);
    console.log(`  Requests Processed: ${summary.metrics.requestsProcessed}`);
    console.log(`  Agents Active: ${summary.metrics.agentsActive}`);
    console.log(`  Success Rate: ${summary.metrics.successRate}%`);
    console.log(`  Avg Response Time: ${summary.metrics.averageResponseTime}ms\n`);
  }
}

/**
 * List agents
 */
function listAgents(kernel) {
  const agents = Array.from(kernel.agentRegistry.values());
  
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║              REGISTERED AGENTS (${agents.length})                  ║
╚════════════════════════════════════════════════════════════════╝
`);

  for (const agent of agents) {
    console.log(`\n[${agent.status.toUpperCase()}] ${agent.name}`);
    console.log(`  ID: ${agent.id}`);
    console.log(`  Role: ${agent.role}`);
    console.log(`  Domain: ${agent.domain || 'general'}`);
    console.log(`  Description: ${agent.description}`);
    console.log(`  Capabilities: ${agent.capabilities.length}`);
    if (agent.capabilities.length > 0) {
      for (const cap of agent.capabilities) {
        console.log(`    • ${cap.name} (${cap.type})`);
      }
    }
    console.log(`  Tools: ${agent.tools.length}`);
    if (agent.tools.length > 0) {
      for (const tool of agent.tools) {
        console.log(`    • ${tool.name} (${tool.service})`);
      }
    }
  }
  console.log(`\n`);
}

/**
 * Execute orchestration
 */
async function executeOrchestration(kernel, objective, options) {
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║              ORCHESTRATION EXECUTION                           ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

  console.log(`Objective: ${objective}`);
  console.log(`Priority: ${options.priority || 'normal'}`);
  console.log(`Mode: ${options.dryRun ? 'DRY-RUN' : 'NORMAL'}\n`);

  try {
    const result = await kernel.executeOrchestration({
      objective,
      priority: options.priority || 'normal',
      parameters: options.parameters || {}
    });

    if (result.success) {
      console.log(`✓ ORCHESTRATION SUCCESSFUL\n`);
      console.log(`Request ID: ${result.requestId}`);
      console.log(`Selected Agents: ${result.selectedAgents.join(', ')}\n`);

      if (options.verbose) {
        console.log(result.explanation);
      } else {
        console.log(`Response Status: ${result.response.status}`);
        console.log(`Confidence: ${result.response.confidence}%\n`);
        console.log(`Primary Objective: ${result.response.primaryResult?.objective}\n`);
        console.log(`Actions: ${result.response.primaryResult?.actions?.length || 0}`);
        console.log(`Recommendations: ${result.response.recommendations.length}\n`);
        console.log(`(Use --verbose for detailed explanation)\n`);
      }
    } else {
      console.log(`✗ ORCHESTRATION FAILED\n`);
      console.log(`Errors:`);
      for (const error of result.errors) {
        console.log(`  • ${error}`);
      }
    }

    // Persist artifacts
    await kernel.persistArtifacts();

  } catch (error) {
    console.log(`✗ ERROR: ${error.message}\n`);
    throw error;
  }
}

/**
 * Main command handler
 */
export async function runAICommand(args) {
  // Initialize orchestrator
  const kernel = new AIOrchestratorKernel();
  kernel.initializeOrchestrator();

  // Register default agents
  kernel.createSpecializedAgents();

  // Parse arguments
  const subcommand = args[0] || 'help';
  const verbose = args.includes('--verbose') || args.includes('-v');
  const dryRun = args.includes('--dry-run');
  const helpFlag = args.includes('--help') || args.includes('-h');

  // Extract priority
  let priority = 'normal';
  const priorityIdx = args.findIndex(a => a === '--priority');
  if (priorityIdx >= 0 && args[priorityIdx + 1]) {
    priority = args[priorityIdx + 1];
  }

  // Extract domain
  let domain = null;
  const domainIdx = args.findIndex(a => a === '--domain');
  if (domainIdx >= 0 && args[domainIdx + 1]) {
    domain = args[domainIdx + 1];
  }

  // Route subcommands
  switch (subcommand) {
    case 'orchestrate': {
      const objective = args.filter(a => 
        !a.startsWith('--') && !['orchestrate'].includes(a)
      )[0] || 'Execute enterprise coordination';
      
      await executeOrchestration(kernel, objective, {
        priority,
        domain,
        verbose,
        dryRun,
        parameters: {}
      });
      break;
    }

    case 'agents': {
      const subSubcommand = args[1];
      
      if (subSubcommand === 'list') {
        listAgents(kernel);
      } else if (subSubcommand === 'status') {
        showStatus(kernel, { agents: true });
      } else if (subSubcommand === 'summary') {
        console.log(`\nAgent Summary:\n`);
        const summary = kernel.getSummary();
        console.log(`  Total: ${summary.agents}`);
        console.log(`  Active: ${summary.agentsActive}\n`);
      } else {
        listAgents(kernel);
      }
      break;
    }

    case 'execute': {
      const objective = args.filter(a => 
        !a.startsWith('--') && !['execute'].includes(a)
      )[0] || 'Execute orchestration workflow';
      
      await executeOrchestration(kernel, objective, {
        priority,
        domain,
        verbose: true,
        dryRun,
        parameters: {}
      });
      break;
    }

    case 'status': {
      const showAgents = args.includes('--agents');
      const showMetrics = args.includes('--metrics');
      showStatus(kernel, { agents: showAgents, metrics: showMetrics });
      break;
    }

    case 'help':
    case '--help':
    case '-h':
      printAIHelp();
      break;

    default:
      console.log(`Unknown subcommand: ${subcommand}\n`);
      console.log(`Use: node tools/genesis/genesis.mjs ai --help\n`);
  }
}
