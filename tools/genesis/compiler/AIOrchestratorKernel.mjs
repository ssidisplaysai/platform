/**
 * AIOrchestratorKernel.mjs
 *
 * Genesis AI Orchestrator Kernel v1
 * Orchestration layer for multi-agent AI collaboration
 *
 * @module tools/genesis/compiler/AIOrchestratorKernel.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  Agent,
  AgentCapability,
  AgentTool,
  AgentContext,
  AgentRequest,
  AgentPlan,
  AgentExecution,
  AgentResponse,
  AgentMemoryReference,
  AIOrchestrator
} from './AIOrchestratorBlueprint.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AIOrchestratorKernel {
  constructor() {
    this.orchestrator = new AIOrchestrator({
      name: 'Genesis AI Orchestrator Kernel',
      description: 'Orchestration layer for coordinating specialized enterprise AI agents'
    });
    this.agentRegistry = new Map(); // ID -> Agent
    this.executionHistory = [];
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Initialize Orchestrator
   */
  initializeOrchestrator() {
    this.orchestrator.markRunning();
    return this;
  }

  /**
   * Register a new agent
   */
  registerAgent(agentData) {
    const agent = new Agent(agentData);
    agent.markActive();
    this.orchestrator.registerAgent(agent);
    this.agentRegistry.set(agent.id, agent);
    return agent;
  }

  /**
   * Create specialized agents for each domain
   */
  createSpecializedAgents() {
    const agents = [];

    // Operations Agent
    const opsAgent = this.registerAgent({
      name: 'Operations Specialist',
      description: 'Specializes in operational planning and execution',
      role: 'specialist',
      domain: 'operations',
      permissions: ['read:operations', 'write:operations', 'execute:operations'],
      accessibleModules: ['planning', 'simulation', 'decision'],
      escalationRules: ['high-impact-changes->approval-required']
    });
    opsAgent.addCapability(new AgentCapability({
      name: 'Operational Planning',
      domain: 'operations',
      type: 'planning'
    }));
    opsAgent.addCapability(new AgentCapability({
      name: 'Process Analysis',
      domain: 'operations',
      type: 'analysis'
    }));
    opsAgent.addTool(new AgentTool({
      name: 'Planning Service',
      type: 'runtime-service',
      service: 'planning',
      requiredParameters: ['objective', 'domain'],
      returnType: 'object'
    }));
    agents.push(opsAgent);

    // Finance Agent
    const finAgent = this.registerAgent({
      name: 'Finance Advisor',
      description: 'Specializes in financial analysis and decisions',
      role: 'specialist',
      domain: 'finance',
      permissions: ['read:finance', 'analyze:finance', 'execute:finance'],
      accessibleModules: ['decision', 'simulation', 'twin'],
      escalationRules: ['large-budgets->approval-required']
    });
    finAgent.addCapability(new AgentCapability({
      name: 'Financial Analysis',
      domain: 'finance',
      type: 'analysis'
    }));
    finAgent.addCapability(new AgentCapability({
      name: 'Cost Optimization',
      domain: 'finance',
      type: 'decision'
    }));
    finAgent.addTool(new AgentTool({
      name: 'Decision Service',
      type: 'runtime-service',
      service: 'decision',
      requiredParameters: ['options', 'criteria'],
      returnType: 'object'
    }));
    agents.push(finAgent);

    // Strategy Agent (Coordinator)
    const stratAgent = this.registerAgent({
      name: 'Strategy Coordinator',
      description: 'Coordinates multi-agent collaboration',
      role: 'coordinator',
      domain: 'strategy',
      permissions: ['coordinate:agents', 'read:all', 'analyze:all'],
      accessibleModules: ['planning', 'decision', 'simulation', 'runtime'],
      escalationRules: ['strategic-initiatives->board-approval']
    });
    stratAgent.addCapability(new AgentCapability({
      name: 'Strategic Planning',
      domain: 'operations',
      type: 'planning'
    }));
    stratAgent.addCapability(new AgentCapability({
      name: 'Multi-Agent Coordination',
      domain: 'strategy',
      type: 'action'
    }));
    stratAgent.addTool(new AgentTool({
      name: 'Orchestration Service',
      type: 'runtime-service',
      service: 'orchestrator'
    }));
    stratAgent.addTool(new AgentTool({
      name: 'Planning Service',
      type: 'runtime-service',
      service: 'planning'
    }));
    stratAgent.addTool(new AgentTool({
      name: 'Decision Service',
      type: 'runtime-service',
      service: 'decision'
    }));
    agents.push(stratAgent);

    // Simulation Agent
    const simAgent = this.registerAgent({
      name: 'Simulation Specialist',
      description: 'Specializes in impact simulation and forecasting',
      role: 'specialist',
      domain: 'analysis',
      permissions: ['read:all', 'simulate:all'],
      accessibleModules: ['simulation', 'twin'],
      escalationRules: []
    });
    simAgent.addCapability(new AgentCapability({
      name: 'Impact Simulation',
      domain: 'operations',
      type: 'simulation'
    }));
    simAgent.addCapability(new AgentCapability({
      name: 'Scenario Analysis',
      domain: 'analysis',
      type: 'analysis'
    }));
    simAgent.addTool(new AgentTool({
      name: 'Simulation Service',
      type: 'runtime-service',
      service: 'simulation'
    }));
    agents.push(simAgent);

    return agents;
  }

  /**
   * Stage 1: Accept Request
   */
  acceptRequest(requestData) {
    const request = new AgentRequest(requestData);
    this.orchestrator.submitRequest(request);
    return request;
  }

  /**
   * Stage 2: Select Agent(s)
   */
  selectAgents(request) {
    const selectedAgents = [];

    // For coordinator/multi-domain requests, select Strategy Coordinator
    if (request.objective.toLowerCase().includes('coordinate') || 
        request.objective.toLowerCase().includes('strategy')) {
      const stratAgent = Array.from(this.agentRegistry.values())
        .find(a => a.role === 'coordinator');
      if (stratAgent) selectedAgents.push(stratAgent);
    }

    // Select specialist agents based on required capabilities
    for (const capName of request.requiredCapabilities) {
      const agent = Array.from(this.agentRegistry.values())
        .find(a => a.capabilities.some(c => c.name === capName));
      if (agent && !selectedAgents.find(sa => sa.id === agent.id)) {
        selectedAgents.push(agent);
      }
    }

    // If no specialists found, select by domain
    if (selectedAgents.length === 0) {
      const agent = Array.from(this.agentRegistry.values())
        .find(a => a.status === 'active');
      if (agent) selectedAgents.push(agent);
    }

    return selectedAgents;
  }

  /**
   * Stage 3: Create Execution Plan
   */
  createExecutionPlan(agent, request) {
    const plan = new AgentPlan({
      agentId: agent.id,
      requestId: request.id
    });

    // Define stages based on agent role
    if (agent.role === 'coordinator') {
      plan.addStage('gather-context', 'Gather required context from all agents');
      plan.addStage('coordinate', 'Coordinate multi-agent execution');
      plan.addStage('merge-results', 'Merge results from collaborating agents');
      plan.addStage('optimize', 'Optimize combined response');
    } else {
      plan.addStage('analyze', 'Analyze request and context');
      plan.addStage('prepare', 'Prepare execution parameters');
      plan.addStage('execute', 'Execute agent tasks');
    }

    // Add tools to sequence
    for (const tool of agent.tools) {
      plan.addToolToSequence(tool.id, tool.name, { service: tool.service });
    }

    // For coordinators, add collaborations
    if (agent.role === 'coordinator') {
      const specialists = Array.from(this.agentRegistry.values())
        .filter(a => a.role === 'specialist' && a.status === 'active');
      for (const specialist of specialists.slice(0, 2)) {
        plan.addCollaboration(specialist.id, specialist.name, 'Specialized analysis');
      }
    }

    plan.estimatedDuration = request.priority === 'critical' ? 30 : 60;
    plan.estimatedCost = 100;
    plan.markApproved();
    return plan;
  }

  /**
   * Stage 4: Execute Agent
   */
  async executeAgent(agent, request, plan) {
    const execution = new AgentExecution({
      agentId: agent.id,
      requestId: request.id,
      planId: plan.id
    });

    try {
      request.markExecuting();

      // Route to appropriate services based on plan
      for (const toolCall of plan.toolSequence) {
        const startTime = Date.now();
        
        let result = null;
        if (toolCall.toolName === 'Planning Service') {
          result = await this.routePlanning(request, agent);
        } else if (toolCall.toolName === 'Decision Service') {
          result = await this.routeDecision(request, agent);
        } else if (toolCall.toolName === 'Simulation Service') {
          result = await this.routeSimulation(request, agent);
        } else {
          result = { message: `Simulated execution of ${toolCall.toolName}` };
        }

        const duration = Date.now() - startTime;
        execution.recordToolExecution(toolCall.toolId, toolCall.toolName, toolCall.parameters, result, duration);
      }

      // Handle multi-agent collaboration if coordinator
      if (agent.role === 'coordinator') {
        for (const collab of plan.collaborations) {
          const collaborator = this.agentRegistry.get(collab.agentId);
          if (collaborator) {
            const collabResult = await this.executeAgent(collaborator, request, plan);
            execution.recordCollaboration(collab.agentId, collab.agentName, collabResult);
          }
        }
      }

      execution.markCompleted();
      execution.outputs.summary = `Successfully executed ${plan.toolSequence.length} tools`;

      return execution;
    } catch (error) {
      execution.recordError(error.message, 'error');
      execution.markFailed();
      throw error;
    }
  }

  /**
   * Route request to Planning Engine
   */
  async routePlanning(request, agent) {
    // Simulated planning service call
    return {
      service: 'planning',
      status: 'success',
      actions: [
        `Plan action 1: ${request.objective}`,
        'Plan action 2: Implementation details',
        'Plan action 3: Risk mitigation'
      ],
      confidence: 85
    };
  }

  /**
   * Route request to Decision Engine
   */
  async routeDecision(request, agent) {
    // Simulated decision service call
    return {
      service: 'decision',
      status: 'success',
      recommendation: 'Option 1 recommended',
      alternatives: ['Option 2', 'Option 3'],
      confidence: 82,
      reasoning: 'Best cost-benefit ratio with lowest risk'
    };
  }

  /**
   * Route request to Simulation Engine
   */
  async routeSimulation(request, agent) {
    // Simulated simulation service call
    return {
      service: 'simulation',
      status: 'success',
      scenarios: ['Best case', 'Baseline', 'Worst case'],
      impactSummary: 'Moderate positive impact expected',
      timeToValue: '90 days'
    };
  }

  /**
   * Stage 5: Merge Results
   */
  mergeResults(executions) {
    const merged = {
      primaryResults: [],
      alternativeResults: [],
      risks: [],
      recommendations: [],
      confidence: 0
    };

    for (const execution of executions) {
      for (const toolExec of execution.toolExecutions) {
        if (toolExec.result.actions) {
          merged.primaryResults.push(...toolExec.result.actions);
        }
        if (toolExec.result.recommendation) {
          merged.recommendations.push(toolExec.result.recommendation);
        }
        if (toolExec.result.confidence) {
          merged.confidence = Math.max(merged.confidence, toolExec.result.confidence);
        }
      }
    }

    return merged;
  }

  /**
   * Stage 6: Generate Response
   */
  generateResponse(request, execution, mergedResults) {
    const response = new AgentResponse({
      agentId: execution.agentId,
      requestId: request.id,
      executionId: execution.id
    });

    response.primaryResult = {
      objective: request.objective,
      actions: mergedResults.primaryResults,
      recommendations: mergedResults.recommendations
    };

    response.reasoning = `Evaluated against ${request.requiredCapabilities.length} capabilities. ` +
      `Executed ${execution.toolExecutions.length} tools successfully.`;
    response.confidence = mergedResults.confidence;

    // Add recommendation for follow-up
    if (response.confidence < 70) {
      response.addRecommendation('Request additional human review due to lower confidence');
    }
    response.addRecommendation('Monitor implementation metrics');

    response.markSuccessful();
    return response;
  }

  /**
   * Stage 7: Generate Explanation
   */
  generateExplanation(request, agents, execution, response) {
    let explanation = `\n${'═'.repeat(60)}\n`;
    explanation += `AI ORCHESTRATION EXECUTION REPORT\n`;
    explanation += `${'═'.repeat(60)}\n\n`;

    explanation += `REQUEST: ${request.objective}\n`;
    explanation += `PRIORITY: ${request.priority.toUpperCase()}\n`;
    explanation += `STATUS: ${response.status.toUpperCase()}\n\n`;

    explanation += `AGENTS INVOLVED (${agents.length}):\n`;
    for (const agent of agents) {
      explanation += `  • ${agent.name} (${agent.role}) - ${agent.domain || 'general'}\n`;
      explanation += `    Capabilities: ${agent.capabilities.length}, Tools: ${agent.tools.length}\n`;
    }

    explanation += `\nEXECUTION DETAILS:\n`;
    explanation += `  • Tools Executed: ${execution.toolExecutions.length}\n`;
    explanation += `  • Collaborations: ${execution.collaborationResults.length}\n`;
    explanation += `  • Errors: ${execution.errors.length}\n`;
    explanation += `  • Warnings: ${execution.warnings.length}\n`;

    explanation += `\nRESULTS:\n`;
    explanation += `  • Primary Result: ${response.primaryResult?.objective || 'N/A'}\n`;
    explanation += `  • Actions Recommended: ${response.recommendations.length}\n`;
    explanation += `  • Confidence: ${response.confidence}%\n`;

    explanation += `\nRECOMMENDATIONS:\n`;
    for (const rec of response.recommendations) {
      explanation += `  • ${rec.text}\n`;
    }

    explanation += `\nRATIONALE:\n`;
    explanation += `  ${response.reasoning}\n`;

    explanation += `\n${'═'.repeat(60)}\n`;

    return explanation;
  }

  /**
   * Execute complete orchestration
   */
  async executeOrchestration(requestData) {
    try {
      // Stage 1: Accept Request
      const request = this.acceptRequest(requestData);

      // Stage 2: Select Agents
      const selectedAgents = this.selectAgents(request);
      if (selectedAgents.length === 0) {
        throw new Error('No agents available for this request');
      }

      // Stage 3: Create Plans
      const plans = [];
      for (const agent of selectedAgents) {
        const plan = this.createExecutionPlan(agent, request);
        plans.push(plan);
      }

      // Stage 4: Execute Agents
      const executions = [];
      for (let i = 0; i < selectedAgents.length; i++) {
        const execution = await this.executeAgent(selectedAgents[i], request, plans[i]);
        executions.push(execution);
      }

      // Stage 5: Merge Results
      const mergedResults = this.mergeResults(executions);

      // Stage 6: Generate Response
      const response = this.generateResponse(request, executions[0], mergedResults);

      // Stage 7: Generate Explanation
      const explanation = this.generateExplanation(request, selectedAgents, executions[0], response);

      // Record in orchestrator
      this.orchestrator.completeRequest(request.id, response);
      this.executionHistory.push({
        request,
        agents: selectedAgents,
        executions,
        response,
        explanation
      });

      return {
        success: true,
        requestId: request.id,
        selectedAgents: selectedAgents.map(a => a.name),
        response,
        explanation,
        errors: this.errors,
        warnings: this.warnings
      };
    } catch (error) {
      this.errors.push(`Orchestration failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Persist Artifacts
   */
  async persistArtifacts() {
    const outputDir = path.join(
      __dirname, 
      '../../..', 
      'out/generated/orchestration',
      `execution-${new Date().toISOString().slice(0, 10)}`
    );

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write orchestrator state
    fs.writeFileSync(
      path.join(outputDir, 'orchestrator-state.json'),
      JSON.stringify(this.orchestrator.toJSON(), null, 2)
    );

    // Write agent registry
    fs.writeFileSync(
      path.join(outputDir, 'agent-registry.json'),
      JSON.stringify(
        Array.from(this.agentRegistry.values()).map(a => a.toJSON()),
        null,
        2
      )
    );

    // Write execution history
    fs.writeFileSync(
      path.join(outputDir, 'execution-history.json'),
      JSON.stringify(
        this.executionHistory.map(e => ({
          requestId: e.request.id,
          agents: e.agents.map(a => a.name),
          status: e.response.status,
          timestamp: e.request.createdAt
        })),
        null,
        2
      )
    );

    return outputDir;
  }

  /**
   * Get orchestrator summary
   */
  getSummary() {
    return {
      orchestratorId: this.orchestrator.id,
      status: this.orchestrator.status,
      agents: this.orchestrator.agents.length,
      agentsActive: this.orchestrator.agents.filter(a => a.status === 'active').length,
      activeRequests: this.orchestrator.activeRequests.length,
      completedRequests: this.orchestrator.completedRequests.length,
      executionHistory: this.executionHistory.length,
      metrics: this.orchestrator.metrics
    };
  }
}
