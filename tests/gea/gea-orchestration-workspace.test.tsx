import { describe, expect, it, jest } from "@jest/globals";
import { renderToString } from "react-dom/server";

jest.mock("@/lib/gea/orchestration-repository", () => ({
  createPrismaOrchestrationRepository: jest.fn(() => ({
    listOrchestrations: async () => [],
    listWorkflows: async () => [],
    listExecutions: async () => [],
    listApprovals: async () => [],
    listReplays: async () => [],
    listHealth: async () => [],
    listCompensations: async () => [],
    saveHealth: async () => ({}),
  })),
}));

import { GeaOrchestrationWorkspace } from "@/components/gea/gea-orchestration-workspace";

describe("gea orchestration workspace", () => {
  it("renders orchestration workspace shell", async () => {
    const html = renderToString(await GeaOrchestrationWorkspace({
      mode: "active",
      permissions: {
        canViewWorkflows: true,
        canExecuteWorkflows: true,
        canCancelWorkflows: true,
        canPauseWorkflows: true,
        canResumeWorkflows: true,
        canReplayWorkflows: true,
        canManageWorkflowDefinitions: true,
        canViewTimeline: true,
        canViewHealth: true,
        canApproveWorkflowStages: true,
      },
    }));

    expect(html).toContain("GEA Orchestration Workspace");
    expect(html).toContain("Genesis Enterprise Multi-Agent Orchestration");
  });
});
