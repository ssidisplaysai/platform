import type { AIAgentDefinition } from "../contracts";

export class AgentRegistry {
  private readonly agents = new Map<string, AIAgentDefinition>();

  register(agent: AIAgentDefinition): void {
    this.agents.set(agent.agentId, structuredClone(agent));
  }

  get(agentId: string): AIAgentDefinition | undefined {
    const agent = this.agents.get(agentId);
    return agent ? structuredClone(agent) : undefined;
  }

  list(): AIAgentDefinition[] {
    return Array.from(this.agents.values()).map((agent) => structuredClone(agent));
  }

  require(agentId: string): AIAgentDefinition {
    const agent = this.get(agentId);
    if (!agent) {
      throw new Error(`unknown agent: ${agentId}`);
    }
    return agent;
  }

  authorize(agentId: string, permission: string): boolean {
    const agent = this.require(agentId);
    return agent.permissions.includes(permission);
  }
}
