import { geaId, stableChecksum, type AgentPlan, type AgentTask } from "./agent-models";
import type { CapabilityDefinition } from "./capability-registry";

export type PlanGenerator = {
  generatePlan: (input: {
    agentId: string;
    objective: string;
    actorId: string;
    capabilities: CapabilityDefinition[];
  }) => AgentPlan;
};

export type TaskPlanner = {
  planTasks: (capabilities: CapabilityDefinition[], objective: string) => AgentTask[];
};

export type ExecutionPlanner = {
  assertPlanImmutable: (plan: AgentPlan, started: boolean) => void;
};

export type DependencyResolver = {
  sort: (tasks: AgentTask[]) => AgentTask[];
};

export function createDependencyResolver(): DependencyResolver {
  return {
    sort(tasks) {
      const byId = new Map(tasks.map((task) => [task.taskId, task]));
      const visiting = new Set<string>();
      const visited = new Set<string>();
      const result: AgentTask[] = [];

      function visit(task: AgentTask): void {
        if (visited.has(task.taskId)) return;
        if (visiting.has(task.taskId)) {
          throw new Error("Circular task dependency detected.");
        }

        visiting.add(task.taskId);
        for (const dep of task.dependsOn) {
          const depTask = byId.get(dep);
          if (!depTask) {
            throw new Error(`Missing dependency task: ${dep}`);
          }
          visit(depTask);
        }
        visiting.delete(task.taskId);
        visited.add(task.taskId);
        result.push(task);
      }

      [...tasks].sort((a, b) => a.taskKey.localeCompare(b.taskKey)).forEach((task) => visit(task));
      return result;
    },
  };
}

export function createTaskPlanner(): TaskPlanner {
  return {
    planTasks(capabilities, objective) {
      const ordered = [...capabilities].sort((a, b) => a.capabilityKey.localeCompare(b.capabilityKey));

      return ordered.map((capability, index) => ({
        taskId: geaId("geatask"),
        taskKey: `${capability.capabilityKey}.task.${index + 1}`,
        title: `${capability.capabilityKey} execution task`,
        dependsOn: index === 0 ? [] : [],
        requiresApproval: capability.capabilityKey === "finance" || capability.capabilityKey === "publishing",
        requiredCapability: capability.capabilityKey,
        toolKey: capability.toolKeys[0],
        input: {
          objective,
          capability: capability.capabilityKey,
        },
      }));
    },
  };
}

export function createPlanGenerator(taskPlanner = createTaskPlanner(), dependencyResolver = createDependencyResolver()): PlanGenerator {
  return {
    generatePlan(input) {
      const tasks = dependencyResolver.sort(taskPlanner.planTasks(input.capabilities, input.objective));
      const dependencyChecksum = stableChecksum(tasks.map((task) => ({
        taskKey: task.taskKey,
        dependsOn: task.dependsOn,
        requiredCapability: task.requiredCapability,
      })));

      return {
        planId: geaId("geaplan"),
        agentId: input.agentId,
        planVersion: "gea-plan/v1",
        objective: input.objective,
        createdBy: input.actorId,
        createdAt: new Date().toISOString(),
        immutableAfterStart: true,
        tasks,
        dependencyChecksum,
      };
    },
  };
}

export function createExecutionPlanner(): ExecutionPlanner {
  return {
    assertPlanImmutable(plan, started) {
      if (plan.immutableAfterStart && started) {
        return;
      }

      if (!plan.immutableAfterStart && started) {
        throw new Error("Execution plan mutability violation.");
      }
    },
  };
}
