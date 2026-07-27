import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/gea/agent-api", () => ({
  handleExecutionTimeline: jest.fn(async () => Response.json({ ok: true })),
  handleGetAgent: jest.fn(async () => Response.json({ agent: true })),
  handleListAgents: jest.fn(async () => Response.json({ agents: [] })),
}));

import { GET as getAgentRoute } from "@/app/api/gea/agents/[id]/route";
import { GET as getAgentsRoute } from "@/app/api/gea/agents/route";
import { GET as getTimelineRoute } from "@/app/api/gea/executions/[executionId]/timeline/route";
import { handleExecutionTimeline, handleGetAgent, handleListAgents } from "@/lib/gea/agent-api";

describe("gea route forwarding", () => {
  it("forwards GET /agents and GET /agents/[id]", async () => {
    const listResponse = await getAgentsRoute(new Request("http://localhost/api/gea/agents"));
    expect(listResponse.status).toBe(200);
    expect(handleListAgents).toHaveBeenCalled();

    const detailResponse = await getAgentRoute(
      new Request("http://localhost/api/gea/agents/agent-1"),
      { params: Promise.resolve({ id: "agent-1" }) },
    );
    expect(detailResponse.status).toBe(200);
    expect(handleGetAgent).toHaveBeenCalled();
  });

  it("forwards GET /executions/[executionId]/timeline", async () => {
    const response = await getTimelineRoute(
      new Request("http://localhost/api/gea/executions/ex-1/timeline"),
      { params: Promise.resolve({ executionId: "ex-1" }) },
    );

    expect(response.status).toBe(200);
    expect(handleExecutionTimeline).toHaveBeenCalled();
  });
});
