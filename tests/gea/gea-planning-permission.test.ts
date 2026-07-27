import { describe, expect, it } from "@jest/globals";
import { createPlanGenerator } from "@/lib/gea/planning-engine";
import { createPermissionEngine } from "@/lib/gea/permission-engine";
import type { CapabilityDefinition } from "@/lib/gea/capability-registry";

const capabilities: CapabilityDefinition[] = [
  {
    capabilityId: "cap-analytics",
    capabilityKey: "analytics",
    capabilityVersion: "gea-capability/v1",
    description: "analytics",
    toolKeys: ["genesis.analytics.snapshot"],
    enabled: true,
  },
  {
    capabilityId: "cap-workflow",
    capabilityKey: "workflow",
    capabilityVersion: "gea-capability/v1",
    description: "workflow",
    toolKeys: ["genesis.workflow.dispatch"],
    enabled: true,
  },
];

describe("gea planning and permissions", () => {
  it("produces deterministic dependency checksum for same input", () => {
    const planGenerator = createPlanGenerator();

    const planA = planGenerator.generatePlan({
      agentId: "agent-1",
      objective: "Prepare summary",
      actorId: "admin@example.com",
      capabilities,
    });

    const planB = planGenerator.generatePlan({
      agentId: "agent-1",
      objective: "Prepare summary",
      actorId: "admin@example.com",
      capabilities,
    });

    expect(planA.tasks.map((t) => t.taskKey)).toEqual(planB.tasks.map((t) => t.taskKey));
    expect(planA.dependencyChecksum).toBe(planB.dependencyChecksum);
  });

  it("enforces default deny when capability or tool policy is missing", () => {
    const permissionEngine = createPermissionEngine();

    const denied = permissionEngine.evaluate({
      workspaceId: "glw-led-display-warehouse",
      role: "ADMINISTRATOR",
      capabilityKey: "analytics",
      toolKey: "genesis.analytics.snapshot",
      runtimeState: "RUNNING",
      allowedActions: [],
    });

    expect(denied.allowed).toBe(false);

    const allowed = permissionEngine.evaluate({
      workspaceId: "glw-led-display-warehouse",
      role: "ADMINISTRATOR",
      capabilityKey: "analytics",
      toolKey: "genesis.analytics.snapshot",
      runtimeState: "RUNNING",
      allowedActions: ["capability:analytics", "tool:genesis.analytics.snapshot"],
    });

    expect(allowed.allowed).toBe(true);
  });
});
