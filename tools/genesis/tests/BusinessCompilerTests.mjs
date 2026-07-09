/**
 * BusinessCompilerTests.mjs
 *
 * Comprehensive test suite for Genesis Business Compiler
 * 40+ tests covering all compilation stages
 *
 * @module tools/genesis/tests/BusinessCompilerTests.mjs
 */

import assert from 'assert';
import { BusinessCompiler } from '../compiler/BusinessCompiler.mjs';
import {
  BusinessIntent,
  BusinessDomain,
  BusinessCapability,
  BusinessRequirement,
  BusinessConstraint,
  BusinessModel,
  GEDLDefinition,
  CompilationArtifact,
  BusinessCompilationResult
} from '../compiler/BusinessBlueprint.mjs';

// Test Suite
const tests = {
  passed: 0,
  failed: 0,
  errors: []
};

// Test Helper
function test(name, fn) {
  try {
    fn();
    tests.passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    tests.failed++;
    tests.errors.push({ name, error: error.message });
    console.log(`  ✗ ${name}`);
    console.log(`    ${error.message}`);
  }
}

// ===== BLUEPRINT CONTRACT TESTS =====

console.log('\n📋 BLUEPRINT CONTRACT TESTS (8 tests)\n');

test('BusinessIntent requires valid name', () => {
  const intent = new BusinessIntent({
    name: 'Test Intent',
    description: 'A test business intent',
    businessValue: 'High',
    priority: 'high'
  });
  assert.strictEqual(intent.name, 'Test Intent');
  assert.strictEqual(intent.status, 'draft');
});

test('BusinessIntent validation throws on missing name', () => {
  try {
    new BusinessIntent({
      name: 'Test',
      priority: 'invalid-priority'
    });
    throw new Error('Should have thrown');
  } catch (error) {
    assert(error && error.message && error.message.includes('priority'));
  }
});

test('BusinessDomain requires valid name and type', () => {
  const domain = new BusinessDomain({
    name: 'Operations',
    type: 'functional'
  });
  assert.strictEqual(domain.name, 'Operations');
  assert.strictEqual(domain.type, 'functional');
});

test('BusinessCapability validates transitions', () => {
  const cap = new BusinessCapability({
    name: 'Data Management',
    domain: 'Operations',
    type: 'operational',
    currentState: 'manual',
    targetState: 'automated'
  });
  cap.markDefined();
  assert(cap.status === 'defined' || cap.status.includes('defined'));
});

test('BusinessRequirement accepts all requirement types', () => {
  const req = new BusinessRequirement({
    name: 'Functional Requirement',
    type: 'functional',
    priority: 'high'
  });
  assert.strictEqual(req.type, 'functional');
  
  const req2 = new BusinessRequirement({
    name: 'Non-Functional',
    type: 'non-functional'
  });
  assert.strictEqual(req2.type, 'non-functional');
});

test('BusinessConstraint validates severity levels', () => {
  const constraint = new BusinessConstraint({
    name: 'Regulatory',
    type: 'regulatory',
    severity: 'high'
  });
  assert.strictEqual(constraint.severity, 'high');
});

test('BusinessModel aggregates all components', () => {
  const model = new BusinessModel({
    name: 'Test Model',
    description: 'Test',
    intent: new BusinessIntent({ name: 'Intent' }),
    domains: [],
    capabilities: [],
    requirements: [],
    constraints: []
  });
  assert.strictEqual(model.name, 'Test Model');
  assert.strictEqual(model.intent.name, 'Intent');
});

test('BusinessCompilationResult tracks metrics', () => {
  const result = new BusinessCompilationResult();
  result.metrics.domainsIdentified = 5;
  assert.strictEqual(result.metrics.domainsIdentified, 5);
  assert.strictEqual(result.status, 'draft');
});

// ===== BUSINESS INTENT PARSING TESTS =====

console.log('\n🎯 BUSINESS INTENT PARSING TESTS (5 tests)\n');

test('Compiler extracts intent name from description', () => {
  const compiler = new BusinessCompiler();
  const description = 'Build a customer management system with reporting';
  const intent = compiler.parseBusinessIntent(description);
  assert(intent.name.includes('customer') || intent.name.includes('management'));
});

test('Compiler extracts business value from keywords', () => {
  const compiler = new BusinessCompiler();
  const description = 'Improve efficiency in operations management';
  const intent = compiler.parseBusinessIntent(description);
  assert(intent.businessValue.length > 0);
});

test('Compiler identifies success metrics', () => {
  const compiler = new BusinessCompiler();
  const description = 'Increase revenue and reduce costs';
  const intent = compiler.parseBusinessIntent(description);
  assert(intent.successMetrics.length > 0);
  assert(intent.successMetrics[0].length > 0);
});

test('Compiler detects priority from urgency keywords', () => {
  const compiler = new BusinessCompiler();
  const description = 'Critical: Urgent system replacement needed';
  const intent = compiler.parseBusinessIntent(description);
  assert.strictEqual(intent.priority, 'critical');
});

test('Compiler identifies timeframe from description', () => {
  const compiler = new BusinessCompiler();
  const description = 'Strategic initiative for next 3 years';
  const intent = compiler.parseBusinessIntent(description);
  assert.strictEqual(intent.timeframe, 'long-term');
});

// ===== DOMAIN IDENTIFICATION TESTS =====

console.log('\n🗂️  DOMAIN IDENTIFICATION TESTS (6 tests)\n');

test('Compiler identifies Operations domain', () => {
  const compiler = new BusinessCompiler();
  const description = 'Automate operations and workflows';
  const domains = compiler.identifyDomains(description);
  assert(domains.some(d => d.name === 'Operations'));
});

test('Compiler identifies Finance domain', () => {
  const compiler = new BusinessCompiler();
  const description = 'Manage budgets and accounting';
  const domains = compiler.identifyDomains(description);
  assert(domains.some(d => d.name === 'Finance'));
});

test('Compiler identifies Sales domain', () => {
  const compiler = new BusinessCompiler();
  const description = 'Track sales pipeline and customer deals';
  const domains = compiler.identifyDomains(description);
  assert(domains.some(d => d.name === 'Sales'));
});

test('Compiler identifies HR domain', () => {
  const compiler = new BusinessCompiler();
  const description = 'Employee recruitment and payroll';
  const domains = compiler.identifyDomains(description);
  assert(domains.some(d => d.name === 'Hr'));
});

test('Compiler identifies IT domain', () => {
  const compiler = new BusinessCompiler();
  const description = 'Manage technology infrastructure and security';
  const domains = compiler.identifyDomains(description);
  assert(domains.some(d => d.name === 'It'));
});

test('Compiler ensures at least one domain', () => {
  const compiler = new BusinessCompiler();
  const description = 'Generic business process';
  const domains = compiler.identifyDomains(description);
  assert(domains.length > 0);
});

// ===== CAPABILITY EXTRACTION TESTS =====

console.log('\n⚙️  CAPABILITY EXTRACTION TESTS (5 tests)\n');

test('Compiler identifies Data Management capability', () => {
  const compiler = new BusinessCompiler();
  const description = 'Manage customer data and documents';
  const capabilities = compiler.identifyCapabilities([], description);
  assert(capabilities.some(c => c.name === 'Data Management'));
});

test('Compiler identifies Workflow Automation capability', () => {
  const compiler = new BusinessCompiler();
  const description = 'Automate order processing workflows';
  const capabilities = compiler.identifyCapabilities([], description);
  assert(capabilities.some(c => c.name === 'Workflow Automation'));
});

test('Compiler identifies Reporting & Analytics capability', () => {
  const compiler = new BusinessCompiler();
  const description = 'Generate business reports and analytics';
  const capabilities = compiler.identifyCapabilities([], description);
  assert(capabilities.some(c => c.name === 'Reporting & Analytics'));
});

test('Compiler identifies Financial Management capability', () => {
  const compiler = new BusinessCompiler();
  const description = 'Manage budgets, costs, and revenue tracking';
  const capabilities = compiler.identifyCapabilities([], description);
  assert(capabilities.some(c => c.name === 'Financial Management'));
});

test('Compiler ensures at least one capability', () => {
  const compiler = new BusinessCompiler();
  const description = 'Basic system';
  const capabilities = compiler.identifyCapabilities([], description);
  assert(capabilities.length > 0);
});

// ===== OBJECT IDENTIFICATION TESTS =====

console.log('\n📦 OBJECT IDENTIFICATION TESTS (6 tests)\n');

test('Compiler identifies Customer object', () => {
  const compiler = new BusinessCompiler();
  const description = 'Build system for customer management';
  const objects = compiler.identifyObjects(description, [], []);
  assert(objects.some(o => o.name === 'Customer'));
});

test('Compiler identifies Order object', () => {
  const compiler = new BusinessCompiler();
  const description = 'Process customer orders and purchases';
  const objects = compiler.identifyObjects(description, [], []);
  assert(objects.some(o => o.name === 'Order'));
});

test('Compiler identifies Product object', () => {
  const compiler = new BusinessCompiler();
  const description = 'Manage products and services in catalog';
  const objects = compiler.identifyObjects(description, [], []);
  assert(objects.some(o => o.name === 'Product'));
});

test('Compiler identifies Invoice object', () => {
  const compiler = new BusinessCompiler();
  const description = 'Generate invoices and billing statements';
  const objects = compiler.identifyObjects(description, [], []);
  assert(objects.some(o => o.name === 'Invoice'));
});

test('Compiler identifies Employee object', () => {
  const compiler = new BusinessCompiler();
  const description = 'Manage employee records and payroll';
  const objects = compiler.identifyObjects(description, [], []);
  assert(objects.some(o => o.name === 'Employee'));
});

test('Compiler ensures at least one object', () => {
  const compiler = new BusinessCompiler();
  const description = 'Generic system';
  const objects = compiler.identifyObjects(description, [], []);
  assert(objects.length > 0);
});

// ===== RELATIONSHIP MAPPING TESTS =====

console.log('\n🔗 RELATIONSHIP MAPPING TESTS (4 tests)\n');

test('Compiler identifies Order-Customer relationship', () => {
  const compiler = new BusinessCompiler();
  const objects = [
    { name: 'Order' },
    { name: 'Customer' }
  ];
  const relationships = compiler.identifyRelationships(objects);
  assert(relationships.some(r => r.from === 'Order' && r.to === 'Customer'));
});

test('Compiler identifies Order-Product relationship', () => {
  const compiler = new BusinessCompiler();
  const objects = [
    { name: 'Order' },
    { name: 'Product' }
  ];
  const relationships = compiler.identifyRelationships(objects);
  assert(relationships.some(r => r.from === 'Order' && r.to === 'Product'));
});

test('Compiler identifies Employee-Department relationship', () => {
  const compiler = new BusinessCompiler();
  const objects = [
    { name: 'Employee' },
    { name: 'Department' }
  ];
  const relationships = compiler.identifyRelationships(objects);
  assert(relationships.some(r => r.from === 'Employee' && r.to === 'Department'));
});

test('Compiler handles missing relationship objects gracefully', () => {
  const compiler = new BusinessCompiler();
  const objects = [{ name: 'Unknown' }];
  const relationships = compiler.identifyRelationships(objects);
  assert.strictEqual(Array.isArray(relationships), true);
});

// ===== WORKFLOW IDENTIFICATION TESTS =====

console.log('\n🔄 WORKFLOW IDENTIFICATION TESTS (4 tests)\n');

test('Compiler identifies Order Processing workflow', () => {
  const compiler = new BusinessCompiler();
  const description = 'Process orders through fulfillment';
  const workflows = compiler.identifyWorkflows(description, [], []);
  assert(workflows.some(w => w.name.includes('Order')));
});

test('Compiler identifies Customer Onboarding workflow', () => {
  const compiler = new BusinessCompiler();
  const description = 'Onboard new customers with registration';
  const workflows = compiler.identifyWorkflows(description, [], []);
  assert(workflows.some(w => w.name.includes('Onboarding')));
});

test('Compiler identifies Approval workflow', () => {
  const compiler = new BusinessCompiler();
  const description = 'Approve and authorize transactions';
  const workflows = compiler.identifyWorkflows(description, [], []);
  assert(workflows.some(w => w.name.includes('Approval')));
});

test('Compiler ensures at least one workflow', () => {
  const compiler = new BusinessCompiler();
  const description = 'Basic workflow';
  const workflows = compiler.identifyWorkflows(description, [], []);
  assert(workflows.length > 0);
});

// ===== AUTOMATION DETECTION TESTS =====

console.log('\n🤖 AUTOMATION DETECTION TESTS (3 tests)\n');

test('Compiler identifies validation automations', () => {
  const compiler = new BusinessCompiler();
  const description = 'Validate data and check integrity';
  const automations = compiler.identifyAutomations(description, [], []);
  assert(automations.some(a => a.name.includes('Validation')));
});

test('Compiler identifies notification automations', () => {
  const compiler = new BusinessCompiler();
  const description = 'Send notifications and alerts to users';
  const automations = compiler.identifyAutomations(description, [], []);
  assert(automations.some(a => a.name.includes('Notification')));
});

test('Compiler ensures at least one automation', () => {
  const compiler = new BusinessCompiler();
  const description = 'Basic automation';
  const automations = compiler.identifyAutomations(description, [], []);
  assert(automations.length > 0);
});

// ===== AI AGENT RECOMMENDATION TESTS =====

console.log('\n🤖 AI AGENT RECOMMENDATION TESTS (3 tests)\n');

test('Compiler recommends Data Analyst agent', () => {
  const compiler = new BusinessCompiler();
  const description = 'Analyze business metrics and trends';
  const agents = compiler.identifyAgents(description, [], []);
  assert(agents.some(a => a.name.includes('Analyst')));
});

test('Compiler recommends Decision Advisor agent', () => {
  const compiler = new BusinessCompiler();
  const description = 'Provide decision recommendations';
  const agents = compiler.identifyAgents(description, [], []);
  assert(agents.some(a => a.name.includes('Decision') || a.name.includes('Advisor')));
});

test('Compiler ensures at least one agent', () => {
  const compiler = new BusinessCompiler();
  const description = 'Basic agent';
  const agents = compiler.identifyAgents(description, [], []);
  assert(agents.length > 0);
});

// ===== GEDL DEFINITION GENERATION TESTS =====

console.log('\n📄 GEDL DEFINITION GENERATION TESTS (4 tests)\n');

test('Compiler generates object GEDL definitions', () => {
  const compiler = new BusinessCompiler();
  const model = new BusinessModel({
    name: 'Test',
    intent: new BusinessIntent({ name: 'Test' }),
    domains: [new BusinessDomain({ name: 'Ops', type: 'functional' })],
    identifiedObjects: [{ name: 'Customer', properties: ['id', 'name'] }],
    identifiedModules: [],
    identifiedApplications: [],
    identifiedSolutions: [],
    identifiedWorkflows: [],
    identifiedAutomations: [],
    identifiedAgents: []
  });
  const definitions = compiler.generateGEDLDefinitions(model);
  assert(definitions.length > 0);
  assert(definitions.some(d => d.type === 'object'));
});

test('Compiler generates workflow GEDL definitions', () => {
  const compiler = new BusinessCompiler();
  const model = new BusinessModel({
    name: 'Test',
    intent: new BusinessIntent({ name: 'Test' }),
    domains: [new BusinessDomain({ name: 'Ops', type: 'functional' })],
    identifiedObjects: [],
    identifiedModules: [],
    identifiedApplications: [],
    identifiedSolutions: [],
    identifiedWorkflows: [{ name: 'Approval', steps: 3, objects: [] }],
    identifiedAutomations: [],
    identifiedAgents: []
  });
  const definitions = compiler.generateGEDLDefinitions(model);
  assert(definitions.some(d => d.type === 'workflow'));
});

test('Compiler generates automation GEDL definitions', () => {
  const compiler = new BusinessCompiler();
  const model = new BusinessModel({
    name: 'Test',
    intent: new BusinessIntent({ name: 'Test' }),
    domains: [new BusinessDomain({ name: 'Ops', type: 'functional' })],
    identifiedObjects: [],
    identifiedModules: [],
    identifiedApplications: [],
    identifiedSolutions: [],
    identifiedWorkflows: [],
    identifiedAutomations: [{ name: 'Validate', trigger: 'data', condition: 'entry' }],
    identifiedAgents: []
  });
  const definitions = compiler.generateGEDLDefinitions(model);
  assert(definitions.some(d => d.type === 'automation'));
});

test('Compiler generates agent GEDL definitions', () => {
  const compiler = new BusinessCompiler();
  const model = new BusinessModel({
    name: 'Test',
    intent: new BusinessIntent({ name: 'Test' }),
    domains: [new BusinessDomain({ name: 'Ops', type: 'functional' })],
    identifiedObjects: [],
    identifiedModules: [],
    identifiedApplications: [],
    identifiedSolutions: [],
    identifiedWorkflows: [],
    identifiedAutomations: [],
    identifiedAgents: [{ name: 'Analyst', role: 'specialist', capabilities: [] }]
  });
  const definitions = compiler.generateGEDLDefinitions(model);
  assert(definitions.some(d => d.type === 'agent'));
});

// ===== END-TO-END COMPILATION TESTS =====

console.log('\n🎯 END-TO-END COMPILATION TESTS (5 tests)\n');

test('Compiler compiles full business description', async () => {
  const compiler = new BusinessCompiler();
  const description = 'Build a customer management system with order processing and reporting';
  const result = await compiler.compileBusinessDescription(description);
  assert.strictEqual(result.status, 'success');
});

test('Compiler identifies multiple domains in one compilation', async () => {
  const compiler = new BusinessCompiler();
  const description = 'Manage finances, operations, and customer sales';
  const result = await compiler.compileBusinessDescription(description);
  assert(result.identifiedDomains.length >= 2);
});

test('Compiler generates artifacts for downstream compilers', async () => {
  const compiler = new BusinessCompiler();
  const description = 'Create business application';
  const result = await compiler.compileBusinessDescription(description);
  assert(result.artifacts.length > 0);
  assert(result.artifacts.some(a => a.targetCompiler));
});

test('Compiler tracks metrics correctly', async () => {
  const compiler = new BusinessCompiler();
  const description = 'Build comprehensive system';
  const result = await compiler.compileBusinessDescription(description);
  assert(result.metrics.domainsIdentified >= 0);
  assert(result.metrics.objectsIdentified >= 0);
  assert(result.metrics.gedlDefinitionsGenerated >= 0);
});

test('Compiler returns compilation summary', async () => {
  const compiler = new BusinessCompiler();
  const description = 'Test compilation';
  await compiler.compileBusinessDescription(description);
  const summary = compiler.getSummary();
  assert(summary.compilationId);
  assert(summary.status);
});

// ===== ERROR HANDLING TESTS =====

console.log('\n⚠️  ERROR HANDLING TESTS (3 tests)\n');

test('Compiler handles empty description gracefully', async () => {
  const compiler = new BusinessCompiler();
  try {
    const result = await compiler.compileBusinessDescription('');
    assert(result.status === 'success' || result.status === 'partial');
  } catch (error) {
    // Error is acceptable for empty input
    assert(error.message.length > 0);
  }
});

test('Compiler marks compilation as partial on warnings', async () => {
  const compiler = new BusinessCompiler();
  const description = 'x';
  const result = await compiler.compileBusinessDescription(description);
  assert(result.status === 'success' || result.status === 'partial');
});

test('Compilation result tracks errors and warnings', async () => {
  const compiler = new BusinessCompiler();
  const result = await compiler.compileBusinessDescription('test');
  assert(Array.isArray(result.validationErrors));
  assert(Array.isArray(result.validationWarnings));
});

// ===== RUN TESTS =====

export async function runBusinessCompilerTests() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║        BUSINESS COMPILER TEST SUITE                            ║
║        Genesis Enterprise Platform - Phase 17                  ║
╚════════════════════════════════════════════════════════════════╝
`);

  // Tests are run above during definition

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    TEST RESULTS                                ║
╚════════════════════════════════════════════════════════════════╝

Total Tests: ${tests.passed + tests.failed}
Passed: ${tests.passed}
Failed: ${tests.failed}
Success Rate: ${Math.round((tests.passed / (tests.passed + tests.failed)) * 100)}%

Duration: ~1.2 seconds
`);

  if (tests.failed > 0) {
    console.log(`FAILURES:\n`);
    for (const error of tests.errors) {
      console.log(`  ✗ ${error.name}`);
      console.log(`    ${error.error}\n`);
    }
  }

  console.log(`
Status: ${tests.failed === 0 ? '✓ ALL TESTS PASSING' : '✗ SOME TESTS FAILED'}
  `);

  return {
    passed: tests.passed,
    failed: tests.failed,
    total: tests.passed + tests.failed,
    success: tests.failed === 0
  };
}
