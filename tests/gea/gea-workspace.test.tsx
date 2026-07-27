import { describe, expect, it, jest } from "@jest/globals";
import { renderToString } from "react-dom/server";

jest.mock("@/lib/gea/agent-repository", () => ({
  createPrismaGeaRepository: jest.fn(() => ({
    listAgents: async () => [],
    listExecutions: async () => [],
    listApprovals: async () => [],
    listAudits: async () => [],
    listReplays: async () => [],
    listMemoryReferences: async () => [],
    saveAgent: async () => null,
  })),
}));

import { GeaWorkspace } from "@/components/gea/gea-workspace";

describe("gea workspace", () => {
  it("renders the enterprise agent workspace shell", async () => {
    const markup = renderToString(await GeaWorkspace({
      mode: "agents",
      permissions: {
        canViewAgents: true,
        canExecuteAgents: true,
        canReplayExecutions: true,
        canApprovePlans: true,
        canManageCapabilities: true,
        canManageTools: true,
        canViewAudit: true,
        canViewMemory: true,
        canManageContext: true,
        canViewHealth: true,
      },
    }));

    expect(markup).toContain("GEA Workspace");
    expect(markup).toContain("Genesis Enterprise Agent Framework");
  });
});
