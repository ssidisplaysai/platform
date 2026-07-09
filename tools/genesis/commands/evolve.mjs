/**
 * evolve.mjs
 *
 * Genesis Enterprise Evolution Engine CLI
 * Commands for enterprise evolution analysis and recommendations
 *
 * @module tools/genesis/commands/evolve.mjs
 */

import { EvolutionEngine } from '../compiler/EvolutionEngine.mjs';

/**
 * Run evolution analysis
 */
async function analyzeEvolution(options = {}) {
  const engine = new EvolutionEngine();

  if (options.verbose) {
    console.log('🔍 Evolution Analysis: Enterprise Structure Evaluation\n');
  }

  const result = await engine.analyzeEvolution({ persist: true });

  // Display results
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║              EVOLUTION ENGINE ANALYSIS RESULTS                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('✓ ANALYSIS COMPLETE\n');
  console.log(`Evolution Session: ${result.id}\n`);

  console.log('ANALYZED ENTERPRISE COMPONENTS:');
  console.log(`  • Observations captured: ${result.metrics.observationsCaptured}`);
  console.log(`  • Candidates identified: ${result.metrics.candidatesIdentified}`);
  console.log(`  • Proposals generated: ${result.metrics.proposalsGenerated}`);
  console.log(`  • Impacts assessed: ${result.metrics.impactsAssessed}`);
  console.log(`  • High priority proposals: ${result.metrics.highPriorityProposals}`);

  console.log(`\nESTIMATED TOTAL ROI: ${result.metrics.totalEstimatedROI?.toFixed(1)}%\n`);

  if (result.recommendation && result.recommendation.proposals.length > 0) {
    console.log('TOP RANKED PROPOSALS:');
    const top3 = result.recommendation.proposals.slice(0, 3);
    top3.forEach((prop, idx) => {
      console.log(`\n  ${idx + 1}. ${prop.title}`);
      console.log(`     Priority: ${prop.priority}`);
      console.log(`     ROI: ${prop.estimatedROI?.toFixed(1)}%`);
      console.log(`     Confidence: ${(prop.confidence?.score * 100)?.toFixed(1)}%`);
      if (prop.impacts && prop.impacts.length > 0) {
        console.log(`     Impacts: ${prop.impacts.map(i => i.category).join(', ')}`);
      }
    });
  }

  if (options.verbose && result.recommendation) {
    console.log('\nRECOMMENDED IMPLEMENTATION PHASING:');
    const phasing = result.recommendation.recommendedPhasing || [];
    phasing.forEach(phase => {
      console.log(`  Phase ${phase.phase}: ${phase.candidates?.join(', ') || 'N/A'}`);
    });

    console.log('\nCRITICAL DEPENDENCIES:');
    (result.recommendation.criticalDependencies || []).forEach(dep => {
      console.log(`  • ${dep}`);
    });
  }

  console.log('\n✓ Evolution artifacts persisted to out/generated/evolution/analysis-{DATE}/\n');
}

/**
 * Generate evolution report
 */
async function generateEvolutionReport(options = {}) {
  const engine = new EvolutionEngine();
  const result = await engine.analyzeEvolution({ persist: false });

  const format = options.format || 'summary';

  if (format === 'detailed') {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║             ENTERPRISE EVOLUTION ANALYSIS REPORT                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log(`ANALYSIS DATE: ${result.createdAt}\n`);

    console.log('EXECUTIVE SUMMARY');
    console.log('─────────────────');
    console.log(`Total Evolution Opportunities: ${result.metrics.candidatesIdentified}`);
    console.log(`Ranked Proposals: ${result.metrics.proposalsGenerated}`);
    console.log(`Estimated Total ROI: ${result.metrics.totalEstimatedROI?.toFixed(1)}%`);
    console.log(`Confidence Level: ${((result.recommendation?.proposals?.[0]?.confidence?.score || 0.7) * 100).toFixed(1)}%\n`);

    if (result.recommendation && result.recommendation.proposals.length > 0) {
      console.log('RANKED PROPOSALS');
      console.log('────────────────');
      result.recommendation.proposals.forEach((prop, idx) => {
        console.log(`\n${idx + 1}. ${prop.title}`);
        console.log(`   Status: ${prop.status}`);
        console.log(`   Priority: ${prop.priority}`);
        console.log(`   Estimated ROI: ${prop.estimatedROI?.toFixed(1)}%`);
        console.log(`   Implementation Timeline: ${prop.candidate_obj?.timelineWeeks || 0} weeks`);
        console.log(`   Complexity: ${prop.candidate_obj?.estimatedComplexity || 'medium'}`);
        console.log(`   Confidence: ${(prop.confidence?.score * 100)?.toFixed(1)}%`);

        if (prop.impacts && prop.impacts.length > 0) {
          console.log(`   Expected Impacts:`);
          prop.impacts.forEach(impact => {
            console.log(`     • ${impact.category}: ${((impact.value - 1) * 100).toFixed(1)}% improvement`);
          });
        }

        if (prop.successCriteria && prop.successCriteria.length > 0) {
          console.log(`   Success Criteria:`);
          prop.successCriteria.forEach(criterion => {
            console.log(`     • ${criterion}`);
          });
        }
      });
    }

    if (result.recommendation?.criticalDependencies) {
      console.log('\n\nCRITICAL DEPENDENCIES');
      console.log('────────────────────');
      result.recommendation.criticalDependencies.forEach(dep => {
        console.log(`  • ${dep}`);
      });
    }

    if (result.recommendation?.recommendedPhasing) {
      console.log('\n\nRECOMMENDED IMPLEMENTATION PHASING');
      console.log('──────────────────────────────────');
      result.recommendation.recommendedPhasing.forEach(phase => {
        console.log(`  Phase ${phase.phase}: ${phase.candidates?.join(', ') || 'N/A'}`);
      });
    }

    if (result.recommendation?.riskMitigation) {
      console.log('\n\nRISK MITIGATION STRATEGIES');
      console.log('──────────────────────────');
      for (const [category, strategy] of Object.entries(result.recommendation.riskMitigation)) {
        console.log(`  ${category.charAt(0).toUpperCase() + category.slice(1)}: ${strategy}`);
      }
    }

    console.log(`\nNext Review Date: ${result.recommendation?.nextReviewDate || 'N/A'}\n`);
  } else if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Summary format (default)
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║             ENTERPRISE EVOLUTION ANALYSIS REPORT                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log(`ANALYSIS: ${result.metrics.candidatesIdentified} opportunities identified`);
    console.log(`PROPOSALS: ${result.metrics.proposalsGenerated} ranked recommendations`);
    console.log(`ESTIMATED ROI: ${result.metrics.totalEstimatedROI?.toFixed(1)}%\n`);

    if (result.recommendation && result.recommendation.proposals.length > 0) {
      console.log('TOP PRIORITY PROPOSALS:');
      result.recommendation.proposals.slice(0, 5).forEach((prop, idx) => {
        console.log(`  ${idx + 1}. ${prop.title} (${prop.priority} | ROI: ${prop.estimatedROI?.toFixed(1)}%)`);
      });
    }

    console.log('');
  }
}

/**
 * List evolution candidates by domain
 */
async function listCandidates(options = {}) {
  const engine = new EvolutionEngine();
  await engine.analyzeEvolution({ persist: false });

  const domain = options.domain;
  let candidates = engine.candidates;

  if (domain) {
    candidates = candidates.filter(c => c.type === domain);
  }

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                 EVOLUTION CANDIDATES                           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  if (candidates.length === 0) {
    console.log('No candidates found\n');
    return;
  }

  console.log(`Total Candidates: ${candidates.length}\n`);

  candidates.forEach((cand, idx) => {
    console.log(`${idx + 1}. ${cand.name}`);
    console.log(`   Domain: ${cand.type}`);
    console.log(`   Complexity: ${cand.estimatedComplexity}`);
    console.log(`   Timeline: ${cand.timelineWeeks} weeks`);
    console.log(`   Affected Entities: ${cand.affectedEntities?.length || 0}`);
    console.log('');
  });
}

/**
 * Show evolution impact analysis
 */
async function showImpactAnalysis(options = {}) {
  const engine = new EvolutionEngine();
  const result = await engine.analyzeEvolution({ persist: false });

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║              EVOLUTION IMPACT ANALYSIS                         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Aggregate impacts by category
  const impactsByCategory = {};
  for (const prop of result.proposals) {
    for (const impact of prop.impacts) {
      if (!impactsByCategory[impact.category]) {
        impactsByCategory[impact.category] = [];
      }
      impactsByCategory[impact.category].push(impact);
    }
  }

  for (const [category, impacts] of Object.entries(impactsByCategory)) {
    const avgValue = impacts.reduce((sum, i) => sum + i.value, 0) / impacts.length;
    const avgConfidence = impacts.reduce((sum, i) => sum + i.confidence, 0) / impacts.length;

    console.log(`${category.toUpperCase()}`);
    console.log(`  Average Improvement: ${((avgValue - 1) * 100).toFixed(1)}%`);
    console.log(`  Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    console.log(`  Affected Proposals: ${impacts.length}`);
    console.log('');
  }
}

/**
 * Show engine status
 */
async function showStatus(options = {}) {
  const engine = new EvolutionEngine();

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║              EVOLUTION ENGINE STATUS                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('Evolution Engine v1 Status: ✓ OPERATIONAL\n');

  console.log('Configured Evolution Domains:');
  engine.evolutionDomains.forEach(domain => {
    console.log(`  ✓ ${domain}`);
  });

  console.log('\nData Sources:');
  engine.sources.forEach(source => {
    console.log(`  ✓ ${source}`);
  });

  console.log('\nCapabilities:');
  console.log('  ✓ Enterprise structure analysis');
  console.log('  ✓ Improvement opportunity identification');
  console.log('  ✓ Impact assessment and forecasting');
  console.log('  ✓ Feasibility evaluation');
  console.log('  ✓ Proposal ranking and prioritization');
  console.log('  ✓ Implementation phasing');
  console.log('  ✓ Risk mitigation planning');
  console.log('  ✓ Artifact persistence\n');

  if (options.verbose) {
    console.log('Evolution Pipeline:');
    console.log('  Stage 1: Capture enterprise observations from 6+ sources');
    console.log('  Stage 2: Identify improvement candidates across 9 domains');
    console.log('  Stage 3: Assess potential impacts on efficiency, agility, cost, etc.');
    console.log('  Stage 4: Evaluate feasibility and risks');
    console.log('  Stage 5: Generate evolution proposals with ROI');
    console.log('  Stage 6: Create ranked recommendations');
    console.log('  Stage 7: Produce analysis result\n');

    console.log('Integration Points:');
    console.log('  • Learning Engine: Uses execution patterns and learning insights');
    console.log('  • Decision Engine: Analyzes decision effectiveness');
    console.log('  • Planning Engine: Evaluates planning accuracy');
    console.log('  • Simulation Engine: Models evolution impact');
    console.log('  • Digital Twin: Analyzes enterprise structure');
    console.log('  • Runtime: Monitors actual metrics\n');
  }
}

/**
 * Print evolution help
 */
function printEvolutionHelp() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║    GENESIS ENTERPRISE EVOLUTION ENGINE - COMMAND HELP            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('USAGE:');
  console.log('  node tools/genesis/genesis.mjs evolve <subcommand> [options]\n');

  console.log('SUBCOMMANDS:\n');

  console.log('  analyze             Analyze enterprise structure and generate proposals');
  console.log('                      Examples:');
  console.log('                        evolve analyze');
  console.log('                        evolve analyze --verbose\n');

  console.log('  report              Generate evolution analysis report');
  console.log('                      Examples:');
  console.log('                        evolve report');
  console.log('                        evolve report --format=detailed\n');

  console.log('  candidates          List evolution candidates');
  console.log('                      Examples:');
  console.log('                        evolve candidates');
  console.log('                        evolve candidates --domain=workflow_redesign\n');

  console.log('  impacts             Show impact analysis');
  console.log('                      Examples:');
  console.log('                        evolve impacts\n');

  console.log('  status              Show evolution engine status');
  console.log('                      Examples:');
  console.log('                        evolve status');
  console.log('                        evolve status --verbose\n');

  console.log('OPTIONS:\n');

  console.log('  --verbose, -v       Show detailed output\n');
  console.log('  --format <type>     Output format: summary, detailed, json\n');
  console.log('  --domain <domain>   Filter by evolution domain\n');
  console.log('  --help, -h          Show this help message\n');

  console.log('EVOLUTION DOMAINS:\n');

  const domains = [
    { name: 'workflow_redesign', desc: 'Workflow and process improvements' },
    { name: 'module_boundaries', desc: 'Module structure and dependencies' },
    { name: 'application_composition', desc: 'Application architecture' },
    { name: 'organizational_structure', desc: 'Organizational hierarchy' },
    { name: 'approval_chains', desc: 'Approval and escalation paths' },
    { name: 'automation_opportunities', desc: 'Automation and RPA' },
    { name: 'reporting_structure', desc: 'Reporting and analytics' },
    { name: 'ai_delegation', desc: 'AI and intelligent automation' },
    { name: 'process_simplification', desc: 'Process optimization' }
  ];

  domains.forEach(d => {
    console.log(`  • ${d.name.padEnd(30)} - ${d.desc}`);
  });

  console.log('\nEXAMPLES:\n');

  console.log('  # Analyze enterprise structure');
  console.log('  node tools/genesis/genesis.mjs evolve analyze\n');

  console.log('  # Generate detailed report');
  console.log('  node tools/genesis/genesis.mjs evolve report --format=detailed\n');

  console.log('  # List candidates in workflow redesign domain');
  console.log('  node tools/genesis/genesis.mjs evolve candidates --domain=workflow_redesign\n');

  console.log('  # Show impact analysis');
  console.log('  node tools/genesis/genesis.mjs evolve impacts\n');

  console.log('  # View engine status');
  console.log('  node tools/genesis/genesis.mjs evolve status --verbose\n');

  console.log('FEATURES:\n');

  console.log('  ✓ Multi-domain enterprise evaluation');
  console.log('  ✓ Observation capture from 6+ sources');
  console.log('  ✓ Candidate identification and ranking');
  console.log('  ✓ Impact forecasting and ROI estimation');
  console.log('  ✓ Risk assessment and mitigation planning');
  console.log('  ✓ Implementation phasing recommendations');
  console.log('  ✓ Feasibility and complexity evaluation');
  console.log('  ✓ Artifact persistence for audit trail\n');
}

/**
 * Main command router
 */
export async function runEvolutionCommand(args) {
  const command = args[0];
  const options = {};

  // Parse options
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      options[key] = value || true;
    } else if (arg.startsWith('-')) {
      options[arg.substring(1)] = true;
    }
  }

  try {
    if (!command || command === '--help' || command === '-h' || command === 'help') {
      printEvolutionHelp();
      return;
    }

    if (command === 'analyze') {
      await analyzeEvolution(options);
    } else if (command === 'report') {
      await generateEvolutionReport(options);
    } else if (command === 'candidates') {
      await listCandidates(options);
    } else if (command === 'impacts') {
      await showImpactAnalysis(options);
    } else if (command === 'status') {
      await showStatus(options);
    } else {
      console.log(`Unknown command: ${command}`);
      console.log('Use --help for available commands\n');
    }
  } catch (err) {
    console.error(`Evolution command failed: ${err.message}`);
    process.exit(1);
  }
}
