import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/gea/tool-api", () => ({
  handleListTools: jest.fn(async () => Response.json({ ok: true })),
  handleToolExecutionDetail: jest.fn(async () => Response.json({ ok: true })),
}));

import { GET as getToolsRoute } from "@/app/api/gea/tools/route";
import { GET as getExecutionRoute } from "@/app/api/gea/tools/executions/[id]/route";
import { handleListTools, handleToolExecutionDetail } from "@/lib/gea/tool-api";

describe("gea tool route forwarding", () => {
  it("forwards base tools route", async () => {
    const response = await getToolsRoute(new Request("http://localhost/api/gea/tools"));
    expect(response.status).toBe(200);
    expect(handleListTools).toHaveBeenCalled();
  });

  it("forwards tool execution detail route", async () => {
    const response = await getExecutionRoute(new Request("http://localhost/api/gea/tools/executions/ex-1"), {
      params: Promise.resolve({ id: "ex-1" }),
    });

    expect(response.status).toBe(200);
    expect(handleToolExecutionDetail).toHaveBeenCalled();
  });
});
