import { describe, expect, it, jest } from "@jest/globals";
import { renderToString } from "react-dom/server";

jest.mock("@/lib/gea/tool-repository", () => ({
  createPrismaToolFrameworkRepository: jest.fn(() => ({
    listValidationRecords: async () => [],
    listPolicyHistory: async () => [],
    listHealthSnapshots: async () => [],
    listExecutions: async () => [],
    listReplayRecords: async () => [],
    listTools: async () => [],
  })),
}));

import { GeaToolWorkspace } from "@/components/gea/gea-tool-workspace";

describe("gea tool workspace", () => {
  it("renders enterprise tool workspace shell", async () => {
    const html = renderToString(await GeaToolWorkspace({
      mode: "catalog",
      permissions: {
        canViewTools: true,
        canExecuteTools: true,
        canReplayExecutions: true,
        canViewAudit: true,
        canManageRegistry: true,
        canManageVersions: true,
        canViewHealth: true,
        canValidateTools: true,
      },
    }));

    expect(html).toContain("GEA Tool Workspace");
    expect(html).toContain("Genesis Enterprise Tool Framework");
  });
});
