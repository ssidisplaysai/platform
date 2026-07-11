/**
 * learn.mjs
 *
 * Genesis Learning Engine CLI
 * Commands for learning analysis and reporting
 *
 * @module tools/genesis/commands/learn.mjs
 */

import { LearningEngine } from '../compiler/LearningEngine.mjs';

/**
 * Print help for learning command
 */
function printLearningHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║    GENESIS ENTERPRISE LEARNING ENGINE - COMMAND HELP            ║
╚════════════════════════════════════════════════════════════════╝

USAGE:
  node tools/genesis/genesis.mjs learn <subcommand> [options]

SUBCOMMANDS:

  analyze             Analyze execution outcomes and generate learning
                      Examples:
                        learn analyze
                        learn analyze --verbose

  report              Generate learning report
                      Examples:
                        learn report
                        learn report --format=detailed

  insights            List generated insights
                      Examples:
                        learn insights
                        learn insights --domain=operations

  recommendations     List recommendations
                      Examples:
                        learn recommendations
                        learn recommendations --priority=high

  patterns            Show identified patterns
                      Examples:
                        learn patterns
                        learn patterns --domain=sales

  signals             Show detected signals
                      Examples:
                        learn signals
                        learn signals --severity=critical

  status              Show learning engine status
                      Examples:
                        learn status
                        learn status --verbose

OPTIONS:

  --verbose, -v       Show detailed output
  
  --format <type>     Output format: summary, detailed, json
  
  --domain <domain>   Filter by learning domain:
                        - operations
                        - manufacturing
                        - inventory
                        - purchasing
                        - sales
                        - finance
                        - customer_service
                        - ai_performance
  
  --priority <level>  Filter by priority: low, medium, high, critical
  
  --severity <level>  Filter by severity: info, warning, critical
  
  --help, -h          Show this help message

EXAMPLES:

  # Analyze execution outcomes
  node tools/genesis/genesis.mjs learn analyze

  # Analyze with verbose output
  node tools/genesis/genesis.mjs learn analyze --verbose

  # Generate learning report
  node tools/genesis/genesis.mjs learn report --format=detailed

  # List insights for specific domain
  node tools/genesis/genesis.mjs learn insights --domain=sales

  # List high-priority recommendations
  node tools/genesis/genesis.mjs learn recommendations --priority=high

  # Show critical signals
  node tools/genesis/genesis.mjs learn signals --severity=critical

  # View learning status
  node tools/genesis/genesis.mjs learn status --verbose

LEARNING DOMAINS:

  • operations       - Operational efficiency and process metrics
  • manufacturing    - Production and quality management
  • inventory        - Stock and inventory optimization
  • purchasing       - Procurement and supplier performance
  • sales            - Sales performance and pipeline
  • finance          - Financial metrics and cost optimization
  • customer_service - Customer satisfaction and service metrics
  • ai_performance   - AI model accuracy and performance

LEARNING COMPONENTS:

  Observations:
    Raw facts captured from enterprise execution
    Sources: runtime, events, workflows, automations, planning, decisions, simulations, AI

  Signals:
    Meaningful events or anomalies detected
    Types: anomaly, trend, threshold, pattern, correlation

  Metrics:
    Measurable performance data
    Categories: performance, quality, efficiency, cost, risk

  Patterns:
    Recurring behaviors or sequences
    Types: sequential, recurring, seasonal, cyclical

  Hypotheses:
    Theories about causation and relationships
    Status lifecycle: draft → tested → validated → approved

  Insights:
    Validated knowledge reusable across enterprises
    Impact levels: low, medium, high, critical

  Recommendations:
    Actionable suggestions based on insights
    Priority levels: low, medium, high, critical

COMPARISONS:

  The Learning Engine compares execution to:
    • Planned vs Actual - Plan adherence and variance
    • Simulated vs Actual - Simulation accuracy
    • Predicted vs Actual - Prediction accuracy
    • Decision vs Outcome - Decision effectiveness

LEARNING OUTPUTS:

  Learning Engine produces:
    ✓ Observable facts from execution
    ✓ Detected anomalies and trends
    ✓ Performance metrics and baselines
    ✓ Recurring patterns and cycles
    ✓ Causation hypotheses
    ✓ Validated insights (reusable)
    ✓ Actionable recommendations
    ✓ Comparison analysis

  Outputs are available to:
    • Digital Twin (context and history)
    • Planning Engine (historical patterns)
    • Decision Engine (outcome data)
    • AI Orchestrator (learning feedback)

METADATA-DRIVEN LEARNING:

  ✓ No embedded business logic
  ✓ Configurable learning domains
  ✓ Extensible component types
  ✓ Traceable evidence chains
  ✓ Confidence scores on all outputs
  ✓ Reusable insights across enterprises

FEATURES:

  ✓ Multi-stage learning pipeline
  ✓ Observation capture from 8+ sources
  ✓ Anomaly and trend detection
  ✓ Pattern recognition
  ✓ Hypothesis generation
  ✓ Insight validation
  ✓ Recommendation generation
  ✓ Comparison analysis
  ✓ Full artifact persistence
  ✓ Evidence tracing
`);
}

/**
 * Analyze execution outcomes
 */
async function analyzeExecutionOutcomes(options = {}) {
  const engine = new LearningEngine(options);
  const result = await engine.analyzeExecutionOutcomes({ persist: true });

  if (options.verbose) {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║           LEARNING ENGINE ANALYSIS RESULTS                      ║
╚════════════════════════════════════════════════════════════════╝
`);

    console.log(`✓ ANALYSIS COMPLETE\n`);
    
    const summary = engine.getSummary();
    console.log(`Learning Session: ${summary.id}`);
    console.log(`Status: ${summary.status}\n`);

    console.log('CAPTURED LEARNING COMPONENTS:');
    console.log(`  • Observations captured: ${summary.metrics.observationsCaptured}`);
    console.log(`  • Signals detected: ${summary.metrics.signalsDetected}`);
    console.log(`  • Metrics collected: ${summary.metrics.metricsCollected}`);
    console.log(`  • Patterns identified: ${summary.metrics.patternsIdentified}`);
    console.log(`  • Hypotheses generated: ${summary.metrics.hypothesesGenerated}`);
    console.log(`  • Insights created: ${summary.metrics.insightsCreated}`);
    console.log(`  • Recommendations generated: ${summary.metrics.recommendationsGenerated}`);
    console.log(`  • Comparisons analyzed: ${summary.metrics.totalComparisons}\n`);

    // Show sample insights
    if (result.insights.length > 0) {
      console.log('SAMPLE INSIGHTS (first 3):');
      for (const insight of result.insights.slice(0, 3)) {
        console.log(`  • ${insight.title}`);
        console.log(`    Domain: ${insight.domain}`);
        console.log(`    Impact: ${insight.impact}`);
        console.log(`    Confidence: ${(insight.confidence * 100).toFixed(1)}%\n`);
      }
    }

    // Show sample recommendations
    if (result.recommendations.length > 0) {
      console.log('SAMPLE RECOMMENDATIONS (first 2):');
      for (const rec of result.recommendations.slice(0, 2)) {
        console.log(`  • ${rec.title}`);
        console.log(`    Priority: ${rec.priority}`);
        console.log(`    Expected Benefit: ${rec.expectedBenefit}`);
        console.log(`    Effort: ${rec.effort}\n`);
      }
    }

    // Show comparison summary
    console.log('COMPARISON ANALYSIS:');
    console.log(`  • Planned vs Actual: ${result.comparisons.plannedVsActual.length} comparisons`);
    console.log(`  • Simulated vs Actual: ${result.comparisons.simulatedVsActual.length} comparisons`);
    console.log(`  • Predicted vs Actual: ${result.comparisons.predictedVsActual.length} comparisons`);
    console.log(`  • Decision vs Outcome: ${result.comparisons.decisionVsOutcome.length} comparisons\n`);

    console.log(`✓ Learning artifacts persisted to out/generated/learning/analysis-${new Date().toISOString().split('T')[0]}/`);
  } else {
    const summary = engine.getSummary();
    console.log(`✓ Learning Analysis Complete`);
    console.log(`  Observations: ${summary.metrics.observationsCaptured}`);
    console.log(`  Signals: ${summary.metrics.signalsDetected}`);
    console.log(`  Patterns: ${summary.metrics.patternsIdentified}`);
    console.log(`  Insights: ${summary.metrics.insightsCreated}`);
    console.log(`  Recommendations: ${summary.metrics.recommendationsGenerated}`);
  }
}

/**
 * Generate learning report
 */
async function generateLearningReport(options = {}) {
  const engine = new LearningEngine(options);
  const result = await engine.analyzeExecutionOutcomes({ persist: false });

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           ENTERPRISE LEARNING REPORT                            ║
╚════════════════════════════════════════════════════════════════╝
`);

  const summary = engine.getSummary();

  console.log(`Learning Session ID: ${summary.id}`);
  console.log(`Generated: ${new Date().toISOString()}\n`);

  console.log('EXECUTIVE SUMMARY:');
  console.log(`  Total Observations: ${summary.metrics.observationsCaptured}`);
  console.log(`  Signals Detected: ${summary.metrics.signalsDetected}`);
  console.log(`  Patterns Identified: ${summary.metrics.patternsIdentified}`);
  console.log(`  Insights Generated: ${summary.metrics.insightsCreated}`);
  console.log(`  Recommendations: ${summary.metrics.recommendationsGenerated}\n`);

  if (options.format === 'detailed') {
    console.log('INSIGHTS:');
    for (const insight of result.insights.slice(0, 5)) {
      console.log(`  • ${insight.title}`);
      console.log(`    Type: ${insight.type}`);
      console.log(`    Domain: ${insight.domain}`);
      console.log(`    Confidence: ${(insight.confidence * 100).toFixed(1)}%`);
      console.log();
    }

    console.log('TOP RECOMMENDATIONS:');
    const highPriority = result.recommendations.filter(r => r.priority === 'high' || r.priority === 'critical');
    for (const rec of highPriority.slice(0, 3)) {
      console.log(`  • [${rec.priority.toUpperCase()}] ${rec.title}`);
      console.log(`    Action: ${rec.action}`);
      console.log(`    Expected Benefit: ${rec.expectedBenefit}`);
      console.log();
    }
  }

  console.log('✓ Report Generated');
}

/**
 * List insights
 */
async function listInsights(options = {}) {
  const engine = new LearningEngine(options);
  const result = await engine.analyzeExecutionOutcomes({ persist: false });

  console.log(`\n📚 INSIGHTS (${result.insights.length} total)\n`);

  const filtered = options.domain
    ? result.insights.filter(i => i.domain === options.domain)
    : result.insights;

  for (const insight of filtered.slice(0, 10)) {
    console.log(`  ✓ ${insight.title}`);
    console.log(`    Domain: ${insight.domain}`);
    console.log(`    Impact: ${insight.impact}`);
    console.log(`    Confidence: ${(insight.confidence * 100).toFixed(1)}%`);
    console.log();
  }

  if (filtered.length > 10) {
    console.log(`  ... and ${filtered.length - 10} more insights`);
  }
}

/**
 * List recommendations
 */
async function listRecommendations(options = {}) {
  const engine = new LearningEngine(options);
  const result = await engine.analyzeExecutionOutcomes({ persist: false });

  console.log(`\n💡 RECOMMENDATIONS (${result.recommendations.length} total)\n`);

  const filtered = options.priority
    ? result.recommendations.filter(r => r.priority === options.priority)
    : result.recommendations;

  for (const rec of filtered.slice(0, 10)) {
    const prioritySymbol = rec.priority === 'critical' ? '🔴' : 
                          rec.priority === 'high' ? '🟠' :
                          rec.priority === 'medium' ? '🟡' : '🟢';
    console.log(`  ${prioritySymbol} ${rec.title}`);
    console.log(`     Priority: ${rec.priority}`);
    console.log(`     Expected: ${rec.expectedBenefit}`);
    console.log();
  }

  if (filtered.length > 10) {
    console.log(`  ... and ${filtered.length - 10} more recommendations`);
  }
}

/**
 * Show patterns
 */
async function showPatterns(options = {}) {
  const engine = new LearningEngine(options);
  const result = await engine.analyzeExecutionOutcomes({ persist: false });

  console.log(`\n🔄 PATTERNS (${result.patterns.length} total)\n`);

  const filtered = options.domain
    ? result.patterns.filter(p => p.domain === options.domain)
    : result.patterns;

  for (const pattern of filtered.slice(0, 10)) {
    console.log(`  ${pattern.name}`);
    console.log(`    Type: ${pattern.patternType}`);
    console.log(`    Frequency: ${(pattern.frequency * 100).toFixed(1)}%`);
    console.log(`    Occurrences: ${pattern.occurrences}`);
    console.log();
  }
}

/**
 * Show signals
 */
async function showSignals(options = {}) {
  const engine = new LearningEngine(options);
  const result = await engine.analyzeExecutionOutcomes({ persist: false });

  console.log(`\n⚠️  SIGNALS (${result.signals.length} total)\n`);

  const filtered = options.severity
    ? result.signals.filter(s => s.severity === options.severity)
    : result.signals;

  for (const signal of filtered.slice(0, 10)) {
    const severitySymbol = signal.severity === 'critical' ? '🔴' :
                          signal.severity === 'warning' ? '🟠' : '🔵';
    console.log(`  ${severitySymbol} ${signal.type.toUpperCase()}`);
    console.log(`     Domain: ${signal.domain}`);
    console.log(`     Severity: ${signal.severity}`);
    console.log(`     Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
    console.log();
  }
}

/**
 * Show status
 */
async function showStatus(options = {}) {
  const engine = new LearningEngine(options);

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           LEARNING ENGINE STATUS                                ║
╚════════════════════════════════════════════════════════════════╝
`);

  console.log('Learning Engine v1 Status: ✓ OPERATIONAL\n');

  console.log('Configured Learning Domains:');
  for (const domain of engine.learningDomains) {
    console.log(`  ✓ ${domain}`);
  }

  console.log('\nCapabilities:');
  console.log(`  ✓ Multi-source observation capture`);
  console.log(`  ✓ Anomaly and signal detection`);
  console.log(`  ✓ Pattern recognition`);
  console.log(`  ✓ Hypothesis generation`);
  console.log(`  ✓ Insight creation and validation`);
  console.log(`  ✓ Recommendation generation`);
  console.log(`  ✓ Execution comparison (planned vs actual, etc.)`);
  console.log(`  ✓ Artifact persistence`);

  console.log('\nLearning Pipeline:');
  console.log(`  Stage 1: Capture observations from multiple sources`);
  console.log(`  Stage 2: Detect signals (anomalies, trends)`);
  console.log(`  Stage 3: Collect and track metrics`);
  console.log(`  Stage 4: Identify patterns and cycles`);
  console.log(`  Stage 5: Generate hypotheses`);
  console.log(`  Stage 6: Create insights`);
  console.log(`  Stage 7: Generate recommendations`);

  if (options.verbose) {
    console.log('\nIntegration Points:');
    console.log(`  ✓ Digital Twin (historical context)`);
    console.log(`  ✓ Planning Engine (pattern insights)`);
    console.log(`  ✓ Decision Engine (outcome analysis)`);
    console.log(`  ✓ AI Orchestrator (learning feedback)`);
  }
}

/**
 * Main command router
 */
export async function runLearningCommand(args) {
  if (!args || args.length === 0) {
    printLearningHelp();
    return;
  }

  const command = args[0];
  const options = {};

  // Parse options
  for (const arg of args.slice(1)) {
    if (arg === '--help' || arg === '-h') {
      printLearningHelp();
      return;
    }
    if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    }
    if (arg.startsWith('--format=')) {
      options.format = arg.split('=')[1];
    }
    if (arg.startsWith('--domain=')) {
      options.domain = arg.split('=')[1];
    }
    if (arg.startsWith('--priority=')) {
      options.priority = arg.split('=')[1];
    }
    if (arg.startsWith('--severity=')) {
      options.severity = arg.split('=')[1];
    }
  }

  switch (command) {
    case 'analyze':
      await analyzeExecutionOutcomes(options);
      break;
    case 'report':
      await generateLearningReport(options);
      break;
    case 'insights':
      await listInsights(options);
      break;
    case 'recommendations':
      await listRecommendations(options);
      break;
    case 'patterns':
      await showPatterns(options);
      break;
    case 'signals':
      await showSignals(options);
      break;
    case 'status':
      await showStatus(options);
      break;
    case '--help':
    case '-h':
      printLearningHelp();
      break;
    default:
      console.log(`Unknown command: ${command}`);
      printLearningHelp();
  }
}
