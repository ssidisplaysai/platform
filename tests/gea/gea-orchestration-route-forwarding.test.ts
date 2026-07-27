import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/gea/orchestration-api", () => ({
  handleOrchestrations: jest.fn(async () => Response.json({ ok: true })),
  handleGetOrchestration: jest.fn(async () => Response.json({ ok: true })),
  handleStartOrchestration: jest.fn(async () => Response.json({ ok: true })),
  handleCancelOrchestration: jest.fn(async () => Response.json({ ok: true })),
  handlePauseOrchestration: jest.fn(async () => Response.json({ ok: true })),
  handleResumeOrchestration: jest.fn(async () => Response.json({ ok: true })),
  handleReplayOrchestration: jest.fn(async () => Response.json({ ok: true })),
  handleWorkflows: jest.fn(async () => Response.json({ ok: true })),
  handleGetWorkflow: jest.fn(async () => Response.json({ ok: true })),
  handleOrchestrationHealth: jest.fn(async () => Response.json({ ok: true })),
  handleOrchestrationTimeline: jest.fn(async () => Response.json({ ok: true })),
  handleOrchestrationApprovals: jest.fn(async () => Response.json({ ok: true })),
}));

import { GET as getOrchestrationsRoute } from "@/app/api/gea/orchestrations/route";
import { GET as getOrchestrationDetailRoute } from "@/app/api/gea/orchestrations/[id]/route";
import { POST as postStartRoute } from "@/app/api/gea/orchestrations/start/route";
import { POST as postCancelRoute } from "@/app/api/gea/orchestrations/cancel/route";
import { POST as postPauseRoute } from "@/app/api/gea/orchestrations/pause/route";
import { POST as postResumeRoute } from "@/app/api/gea/orchestrations/resume/route";
import { POST as postReplayRoute } from "@/app/api/gea/orchestrations/replay/route";
import { GET as getWorkflowsRoute } from "@/app/api/gea/workflows/route";
import { GET as getWorkflowDetailRoute } from "@/app/api/gea/workflows/[id]/route";
import { GET as getHealthRoute } from "@/app/api/gea/orchestrations/health/route";
import { GET as getTimelineRoute } from "@/app/api/gea/orchestrations/timeline/route";
import { GET as getApprovalsRoute } from "@/app/api/gea/orchestrations/approvals/route";

import {
  handleCancelOrchestration,
  handleGetOrchestration,
  handleGetWorkflow,
  handleOrchestrationApprovals,
  handleOrchestrationHealth,
  handleOrchestrationTimeline,
  handleOrchestrations,
  handlePauseOrchestration,
  handleReplayOrchestration,
  handleResumeOrchestration,
  handleStartOrchestration,
  handleWorkflows,
} from "@/lib/gea/orchestration-api";

describe("gea orchestration route forwarding", () => {
  it("forwards orchestration and workflow routes", async () => {
    await getOrchestrationsRoute(new Request("http://localhost/api/gea/orchestrations"));
    await getOrchestrationDetailRoute(new Request("http://localhost/api/gea/orchestrations/o-1"), { params: Promise.resolve({ id: "o-1" }) });
    await postStartRoute(new Request("http://localhost/api/gea/orchestrations/start", { method: "POST" }));
    await postCancelRoute(new Request("http://localhost/api/gea/orchestrations/cancel", { method: "POST" }));
    await postPauseRoute(new Request("http://localhost/api/gea/orchestrations/pause", { method: "POST" }));
    await postResumeRoute(new Request("http://localhost/api/gea/orchestrations/resume", { method: "POST" }));
    await postReplayRoute(new Request("http://localhost/api/gea/orchestrations/replay", { method: "POST" }));
    await getWorkflowsRoute(new Request("http://localhost/api/gea/workflows"));
    await getWorkflowDetailRoute(new Request("http://localhost/api/gea/workflows/w-1"), { params: Promise.resolve({ id: "w-1" }) });
    await getHealthRoute(new Request("http://localhost/api/gea/orchestrations/health"));
    await getTimelineRoute(new Request("http://localhost/api/gea/orchestrations/timeline"));
    await getApprovalsRoute(new Request("http://localhost/api/gea/orchestrations/approvals"));

    expect(handleOrchestrations).toHaveBeenCalled();
    expect(handleGetOrchestration).toHaveBeenCalled();
    expect(handleStartOrchestration).toHaveBeenCalled();
    expect(handleCancelOrchestration).toHaveBeenCalled();
    expect(handlePauseOrchestration).toHaveBeenCalled();
    expect(handleResumeOrchestration).toHaveBeenCalled();
    expect(handleReplayOrchestration).toHaveBeenCalled();
    expect(handleWorkflows).toHaveBeenCalled();
    expect(handleGetWorkflow).toHaveBeenCalled();
    expect(handleOrchestrationHealth).toHaveBeenCalled();
    expect(handleOrchestrationTimeline).toHaveBeenCalled();
    expect(handleOrchestrationApprovals).toHaveBeenCalled();
  });
});
