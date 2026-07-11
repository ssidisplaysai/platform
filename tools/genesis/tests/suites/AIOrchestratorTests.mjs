/**
 * AIOrchestratorTests.mjs
 *
 * Test suite for Genesis AI Orchestrator Kernel v1
 * Comprehensive coverage of agent orchestration and coordination
 *
 * @module tools/genesis/tests/suites/AIOrchestratorTests.mjs
 */

import { TestSuite } from '../TestSuite.mjs';
import {
  AgentCapability,
  AgentTool,
  AgentContext,
  AgentRequest,
  AgentPlan,
  AgentExecution,
  AgentResponse,
  AgentMemoryReference,
  Agent,
  AIOrchestrator
} from '../../compiler/AIOrchestratorBlueprint.mjs';
import { AIOrchestratorKernel } from '../../compiler/AIOrchestratorKernel.mjs';

export default async function AIOrchestratorTestSuite() {
  const suite = new TestSuite(
    'AI Orchestrator Tests',
    'Test Genesis AI Orchestrator Kernel v1'
  );

  // ===== AgentCapability Tests (3 tests) =====

  suite.addTest('AgentCapability initializes', async () => {
    const cap = new AgentCapability({
      name: 'Operational Planning',
      domain: 'operations',
      type: 'planning'
    });
    if (!cap.id) throw new Error('Capability ID not set');
    if (cap.name !== 'Operational Planning') throw new Error('Name not set');
    if (cap.domain !== 'operations') throw new Error('Domain not set');
  });

  suite.addTest('AgentCapability validation works', async () => {
    try {
      new AgentCapability({ type: 'invalid-type' });
      throw new Error('Should have thrown');
    } catch (e) {
      if (!e.message.includes('Invalid capability type')) throw e;
    }
  });

  suite.addTest('AgentCapability serialization', async () => {
    const cap = new AgentCapability({
      name: 'Risk Analysis',
      riskLevel: 'high',
      requiresApproval: true
    });
    const json = cap.toJSON();
    if (!json.id || json.name !== 'Risk Analysis') throw new Error('Serialization failed');
    if (json.riskLevel !== 'high') throw new Error('Risk level not serialized');
  });

  // ===== AgentTool Tests (3 tests) =====

  suite.addTest('AgentTool initializes', async () => {
    const tool = new AgentTool({
      name: 'Planning Service',
      type: 'runtime-service',
      service: 'planning'
    });
    if (!tool.id) throw new Error('Tool ID not set');
    if (tool.name !== 'Planning Service') throw new Error('Name not set');
    if (tool.service !== 'planning') throw new Error('Service not set');
  });

  suite.addTest('AgentTool validation works', async () => {
    try {
      new AgentTool({ name: 'Test', type: 'invalid' });
      throw new Error('Should have thrown');
    } catch (e) {
      if (!e.message.includes('Invalid tool type')) throw e;
    }
  });

  suite.addTest('AgentTool parameter tracking', async () => {
    const tool = new AgentTool({
      name: 'Decision Tool',
      requiredParameters: ['options', 'criteria'],
      optionalParameters: ['weights', 'constraints']
    });
    if (tool.requiredParameters.length !== 2) throw new Error('Required params not tracked');
    if (tool.optionalParameters.length !== 2) throw new Error('Optional params not tracked');
  });

  // ===== AgentContext Tests (3 tests) =====

  suite.addTest('AgentContext initializes', async () => {
    const ctx = new AgentContext({
      tenantId: 'corp-001',
      userId: 'user-123'
    });
    if (!ctx.id) throw new Error('Context ID not set');
    if (ctx.tenantId !== 'corp-001') throw new Error('Tenant not set');
    if (ctx.status !== 'initialized') throw new Error('Status not initialized');
  });

  suite.addTest('AgentContext status transitions', async () => {
    const ctx = new AgentContext();
    ctx.markActive();
    if (ctx.status !== 'active') throw new Error('Failed to mark active');
    ctx.markAwaitingApproval();
    if (ctx.status !== 'awaiting-approval') throw new Error('Failed to mark awaiting approval');
    ctx.markCompleted();
    if (ctx.status !== 'completed') throw new Error('Failed to mark completed');
  });

  suite.addTest('AgentContext access control', async () => {
    const ctx = new AgentContext({
      permissions: ['read:all', 'write:operations'],
      accessibleModules: ['planning', 'decision'],
      accessibleTools: ['planning-service', 'decision-service']
    });
    if (ctx.permissions.length !== 2) throw new Error('Permissions not set');
    if (ctx.accessibleModules.length !== 2) throw new Error('Modules not set');
    if (ctx.accessibleTools.length !== 2) throw new Error('Tools not set');
  });

  // ===== AgentRequest Tests (3 tests) =====

  suite.addTest('AgentRequest initializes', async () => {
    const req = new AgentRequest({
      objective: 'Optimize operations',
      priority: 'high'
    });
    if (!req.id) throw new Error('Request ID not set');
    if (req.objective !== 'Optimize operations') throw new Error('Objective not set');
    if (req.status !== 'submitted') throw new Error('Status not submitted');
  });

  suite.addTest('AgentRequest validation', async () => {
    try {
      new AgentRequest({ objective: 'Test', priority: 'invalid' });
      throw new Error('Should have thrown');
    } catch (e) {
      if (!e.message.includes('Invalid priority')) throw e;
    }
  });

  suite.addTest('AgentRequest status lifecycle', async () => {
    const req = new AgentRequest({ objective: 'Test' });
    req.markAccepted();
    if (req.status !== 'accepted') throw new Error('Failed to mark accepted');
    req.markExecuting();
    if (req.status !== 'executing') throw new Error('Failed to mark executing');
    req.markCompleted();
    if (req.status !== 'completed') throw new Error('Failed to mark completed');
  });

  // ===== AgentPlan Tests (2 tests) =====

  suite.addTest('AgentPlan initializes and builds stages', async () => {
    const plan = new AgentPlan({ agentId: 'ag-1', requestId: 'req-1' });
    plan.addStage('analyze', 'Analyze request');
    plan.addStage('execute', 'Execute tasks');
    if (plan.stages.length !== 2) throw new Error('Stages not added');
    if (plan.stages[0].name !== 'analyze') throw new Error('Stage name incorrect');
  });

  suite.addTest('AgentPlan tool sequence and collaboration', async () => {
    const plan = new AgentPlan();
    plan.addToolToSequence('tool-1', 'Planning', { service: 'planning' });
    plan.addToolToSequence('tool-2', 'Decision', { service: 'decision' });
    plan.addCollaboration('ag-2', 'Finance Agent', 'Financial analysis');
    
    if (plan.toolSequence.length !== 2) throw new Error('Tools not added');
    if (plan.collaborations.length !== 1) throw new Error('Collaboration not added');
  });

  // ===== AgentExecution Tests (3 tests) =====

  suite.addTest('AgentExecution initializes', async () => {
    const exec = new AgentExecution({
      agentId: 'ag-1',
      requestId: 'req-1'
    });
    if (!exec.id) throw new Error('Execution ID not set');
    if (exec.status !== 'started') throw new Error('Status not started');
  });

  suite.addTest('AgentExecution records tool calls', async () => {
    const exec = new AgentExecution();
    exec.recordToolExecution('tool-1', 'Planning', {}, { actions: [] }, 150);
    exec.recordToolExecution('tool-2', 'Decision', {}, { decision: 'option-1' }, 200);
    
    if (exec.toolExecutions.length !== 2) throw new Error('Tool calls not recorded');
    if (exec.toolExecutions[0].duration !== 150) throw new Error('Duration not recorded');
  });

  suite.addTest('AgentExecution error and warning tracking', async () => {
    const exec = new AgentExecution();
    exec.recordWarning('Non-critical issue');
    exec.recordError('Critical issue', 'error');
    exec.recordError('Warning-level error', 'warning');
    
    if (exec.warnings.length !== 1) throw new Error('Warning not recorded');
    if (exec.errors.length !== 2) throw new Error('Errors not recorded');
  });

  // ===== AgentResponse Tests (2 tests) =====

  suite.addTest('AgentResponse initializes', async () => {
    const resp = new AgentResponse({
      agentId: 'ag-1',
      confidence: 85
    });
    if (!resp.id) throw new Error('Response ID not set');
    if (resp.status !== 'initiated') throw new Error('Status not initiated');
    if (resp.confidence !== 85) throw new Error('Confidence not set');
  });

  suite.addTest('AgentResponse approval workflow', async () => {
    const resp = new AgentResponse({ requiresApproval: true });
    resp.markApprovalRequired();
    if (!resp.requiresApproval) throw new Error('Approval not required');
    
    resp.markApproved();
    if (resp.approvalStatus !== 'approved') throw new Error('Not marked approved');
  });

  // ===== Agent Tests (3 tests) =====

  suite.addTest('Agent initializes with capabilities', async () => {
    const agent = new Agent({
      name: 'Operations Specialist',
      role: 'specialist',
      domain: 'operations'
    });
    
    agent.addCapability(new AgentCapability({
      name: 'Operational Planning',
      domain: 'operations'
    }));
    
    if (!agent.id) throw new Error('Agent ID not set');
    if (agent.capabilities.length !== 1) throw new Error('Capability not added');
  });

  suite.addTest('Agent tools and permissions', async () => {
    const agent = new Agent({ name: 'Finance Agent' });
    agent.addTool(new AgentTool({
      name: 'Decision Service',
      service: 'decision'
    }));
    agent.permissions = ['read:finance', 'analyze:finance'];
    agent.accessibleModules = ['decision', 'simulation'];
    
    if (agent.tools.length !== 1) throw new Error('Tool not added');
    if (agent.permissions.length !== 2) throw new Error('Permissions not set');
  });

  suite.addTest('Agent status management', async () => {
    const agent = new Agent({ name: 'Test Agent' });
    if (agent.status !== 'registered') throw new Error('Status not registered');
    
    agent.markActive();
    if (agent.status !== 'active') throw new Error('Status not active');
    
    agent.markSuspended();
    if (agent.status !== 'suspended') throw new Error('Status not suspended');
  });

  // ===== AIOrchestrator Tests (2 tests) =====

  suite.addTest('AIOrchestrator initializes', async () => {
    const orch = new AIOrchestrator();
    if (!orch.id) throw new Error('Orchestrator ID not set');
    if (orch.status !== 'initialized') throw new Error('Status not initialized');
  });

  suite.addTest('AIOrchestrator agent registration and requests', async () => {
    const orch = new AIOrchestrator();
    const agent = new Agent({ name: 'Test Agent' });
    
    orch.registerAgent(agent);
    if (orch.agents.length !== 1) throw new Error('Agent not registered');
    
    const req = new AgentRequest({ objective: 'Test' });
    orch.submitRequest(req);
    if (orch.activeRequests.length !== 1) throw new Error('Request not submitted');
  });

  // ===== AIOrchestratorKernel Core Tests (3 tests) =====

  suite.addTest('AIOrchestratorKernel initializes', async () => {
    const kernel = new AIOrchestratorKernel();
    kernel.initializeOrchestrator();
    
    if (kernel.orchestrator.status !== 'running') throw new Error('Kernel not running');
  });

  suite.addTest('AIOrchestratorKernel registers agents', async () => {
    const kernel = new AIOrchestratorKernel();
    kernel.initializeOrchestrator();
    
    const agents = kernel.createSpecializedAgents();
    if (agents.length === 0) throw new Error('No agents created');
    if (kernel.agentRegistry.size === 0) throw new Error('Agents not registered');
    if (kernel.orchestrator.agents.length === 0) throw new Error('Agents not in orchestrator');
  });

  suite.addTest('AIOrchestratorKernel agent selection', async () => {
    const kernel = new AIOrchestratorKernel();
    kernel.createSpecializedAgents();
    
    const request = new AgentRequest({
      objective: 'Optimize operations',
      requiredCapabilities: ['Operational Planning']
    });
    
    const selected = kernel.selectAgents(request);
    if (selected.length === 0) throw new Error('No agents selected');
  });

  // ===== Orchestration Planning Tests (3 tests) =====

  suite.addTest('Orchestration creates execution plans', async () => {
    const kernel = new AIOrchestratorKernel();
    kernel.createSpecializedAgents();
    
    const agent = Array.from(kernel.agentRegistry.values())[0];
    const request = new AgentRequest({ objective: 'Test orchestration' });
    
    const plan = kernel.createExecutionPlan(agent, request);
    if (!plan.id) throw new Error('Plan ID not set');
    if (plan.stages.length === 0) throw new Error('No stages in plan');
  });

  suite.addTest('Execution plan tool sequencing', async () => {
    const kernel = new AIOrchestratorKernel();
    kernel.createSpecializedAgents();
    
    const agent = kernel.agentRegistry.get(
      Array.from(kernel.agentRegistry.keys())[2]
    ); // Get Strategy Coordinator
    const request = new AgentRequest({ objective: 'Strategic planning' });
    
    const plan = kernel.createExecutionPlan(agent, request);
    if (plan.toolSequence.length === 0) throw new Error('No tools in sequence');
  });

  suite.addTest('Plan collaboration tracking', async () => {
    const kernel = new AIOrchestratorKernel();
    kernel.createSpecializedAgents();
    
    const agent = kernel.agentRegistry.get(
      Array.from(kernel.agentRegistry.keys())[2]
    ); // Coordinator
    const request = new AgentRequest({ objective: 'Coordinate' });
    
    const plan = kernel.createExecutionPlan(agent, request);
    if (agent.role === 'coordinator' && plan.collaborations.length === 0) {
      throw new Error('No collaborations in coordinator plan');
    }
  });

  // ===== Execution Tests (2 tests) =====

  suite.addTest('AIOrchestratorKernel executes agents', async () => {
    const kernel = new AIOrchestratorKernel();
    kernel.createSpecializedAgents();
    
    const agent = Array.from(kernel.agentRegistry.values())[0];
    const request = new AgentRequest({ objective: 'Test execution' });
    const plan = kernel.createExecutionPlan(agent, request);
    
    const execution = await kernel.executeAgent(agent, request, plan);
    if (execution.status !== 'completed') throw new Error('Execution not completed');
  });

  suite.addTest('Execution merges results correctly', async () => {
    const kernel = new AIOrchestratorKernel();
    kernel.createSpecializedAgents();
    
    const agent = Array.from(kernel.agentRegistry.values())[0];
    const request = new AgentRequest({ objective: 'Test' });
    const plan = kernel.createExecutionPlan(agent, request);
    
    const execution = await kernel.executeAgent(agent, request, plan);
    const merged = kernel.mergeResults([execution]);
    
    if (!merged.primaryResults) throw new Error('Primary results not merged');
  });

  // ===== Response Generation Tests (2 tests) =====

  suite.addTest('AIOrchestratorKernel generates responses', async () => {
    const kernel = new AIOrchestratorKernel();
    kernel.createSpecializedAgents();
    
    const agent = Array.from(kernel.agentRegistry.values())[0];
    const request = new AgentRequest({ objective: 'Test response' });
    const plan = kernel.createExecutionPlan(agent, request);
    const execution = await kernel.executeAgent(agent, request, plan);
    
    const merged = kernel.mergeResults([execution]);
    const response = kernel.generateResponse(request, execution, merged);
    
    if (response.status !== 'successful') throw new Error('Response not successful');
    if (response.confidence < 0 || response.confidence > 100) throw new Error('Invalid confidence');
  });

  suite.addTest('Response includes recommendations', async () => {
    const kernel = new AIOrchestratorKernel();
    kernel.createSpecializedAgents();
    
    const agent = Array.from(kernel.agentRegistry.values())[0];
    const request = new AgentRequest({ objective: 'Test recommendations' });
    const plan = kernel.createExecutionPlan(agent, request);
    const execution = await kernel.executeAgent(agent, request, plan);
    
    const merged = kernel.mergeResults([execution]);
    const response = kernel.generateResponse(request, execution, merged);
    
    if (response.recommendations.length === 0) throw new Error('No recommendations');
  });

  // ===== Multi-Agent Orchestration Tests (4 tests) =====

  suite.addTest('AIOrchestratorKernel orchestrates end-to-end', async () => {
    const kernel = new AIOrchestratorKernel();
    kernel.initializeOrchestrator();
    kernel.createSpecializedAgents();
    
    const result = await kernel.executeOrchestration({
      objective: 'Strategic planning for operations',
      priority: 'high'
    });
    
    if (!result.success) throw new Error('Orchestration failed');
    if (!result.requestId) throw new Error('Request ID not returned');
    if (result.selectedAgents.length === 0) throw new Error('No agents selected');
  });

  suite.addTest('Multi-agent response merging', async () => {
    const kernel = new AIOrchestratorKernel();
    kernel.initializeOrchestrator();
    kernel.createSpecializedAgents();
    
    const result = await kernel.executeOrchestration({
      objective: 'Coordinate strategic initiative',
      priority: 'critical'
    });
    
    if (result.response.primaryResult.actions.length === 0) {
      throw new Error('No merged actions in response');
    }
  });

  suite.addTest('Orchestration produces explanation', async () => {
    const kernel = new AIOrchestratorKernel();
    kernel.initializeOrchestrator();
    kernel.createSpecializedAgents();
    
    const result = await kernel.executeOrchestration({
      objective: 'Analyze market opportunity',
      priority: 'normal'
    });
    
    if (!result.explanation) throw new Error('Explanation not generated');
    if (result.explanation.length < 100) throw new Error('Explanation too short');
  });

  suite.addTest('Orchestration execution history', async () => {
    const kernel = new AIOrchestratorKernel();
    kernel.initializeOrchestrator();
    kernel.createSpecializedAgents();
    
    if (kernel.executionHistory.length !== 0) throw new Error('History not empty initially');
    
    await kernel.executeOrchestration({ objective: 'First execution' });
    if (kernel.executionHistory.length !== 1) throw new Error('First execution not recorded');
    
    await kernel.executeOrchestration({ objective: 'Second execution' });
    if (kernel.executionHistory.length !== 2) throw new Error('Second execution not recorded');
  });

  // ===== Error Handling Tests (3 tests) =====

  suite.addTest('Orchestrator handles invalid requests', async () => {
    const kernel = new AIOrchestratorKernel();
    kernel.createSpecializedAgents();
    
    try {
      await kernel.executeOrchestration({
        objective: ''  // Invalid empty objective
      });
      throw new Error('Should have thrown');
    } catch (e) {
      if (!e.message) throw e;
    }
  });

  suite.addTest('Agent execution tracks errors', async () => {
    const kernel = new AIOrchestratorKernel();
    kernel.createSpecializedAgents();
    
    const agent = Array.from(kernel.agentRegistry.values())[0];
    const request = new AgentRequest({ objective: 'Test error tracking' });
    const plan = kernel.createExecutionPlan(agent, request);
    
    const execution = await kernel.executeAgent(agent, request, plan);
    if (execution.errors === undefined) throw new Error('Errors not tracked');
  });

  suite.addTest('Orchestration collects warnings', async () => {
    const kernel = new AIOrchestratorKernel();
    kernel.initializeOrchestrator();
    kernel.createSpecializedAgents();
    
    const result = await kernel.executeOrchestration({
      objective: 'Low confidence task',
      priority: 'low'
    });
    
    // Result should not have unhandled warnings
    if (result.warnings === undefined) throw new Error('Warnings not tracked');
  });

  // ===== Summary and Metrics Tests (2 tests) =====

  suite.addTest('Orchestrator provides summary metrics', async () => {
    const kernel = new AIOrchestratorKernel();
    kernel.initializeOrchestrator();
    kernel.createSpecializedAgents();
    
    const summary = kernel.getSummary();
    if (!summary.orchestratorId) throw new Error('Orchestrator ID not in summary');
    if (summary.agents === 0) throw new Error('Agents not counted');
  });

  suite.addTest('Metrics track completions and history', async () => {
    const kernel = new AIOrchestratorKernel();
    kernel.initializeOrchestrator();
    kernel.createSpecializedAgents();
    
    await kernel.executeOrchestration({ objective: 'Track metrics' });
    
    const summary = kernel.getSummary();
    if (summary.completedRequests !== 1) throw new Error('Completed requests not tracked');
    if (summary.executionHistory !== 1) throw new Error('Execution history not tracked');
  });

  return suite;
}
