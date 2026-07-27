import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/gea/agent-api", () => ({
  handleMemoryReferences: jest.fn(async () => Response.json({ mode: "agent-memory" })),
}));

jest.mock("@/lib/gea/memory-api", () => ({
  handleMemory: jest.fn(async () => Response.json({ mode: "registry-memory" })),
  handleGetMemory: jest.fn(async () => Response.json({ mode: "memory-detail" })),
  handleContext: jest.fn(async () => Response.json({ mode: "context" })),
  handleContextBuild: jest.fn(async () => Response.json({ mode: "build" })),
  handleContextReplay: jest.fn(async () => Response.json({ mode: "replay" })),
  handleContextHealth: jest.fn(async () => Response.json({ mode: "health" })),
  handleContextVersions: jest.fn(async () => Response.json({ mode: "versions" })),
  handleContextProvenance: jest.fn(async () => Response.json({ mode: "provenance" })),
  handleContextCache: jest.fn(async () => Response.json({ mode: "cache" })),
  handleContextValidation: jest.fn(async () => Response.json({ mode: "validation" })),
}));

import { GET as getMemoryRoute, POST as postMemoryRoute } from "@/app/api/gea/memory/route";
import { GET as getMemoryByIdRoute } from "@/app/api/gea/memory/[id]/route";
import { GET as getContextRoute } from "@/app/api/gea/context/route";
import { POST as postContextBuildRoute } from "@/app/api/gea/context/build/route";
import { POST as postContextReplayRoute } from "@/app/api/gea/context/replay/route";
import { GET as getContextHealthRoute } from "@/app/api/gea/context/health/route";
import { GET as getContextVersionsRoute } from "@/app/api/gea/context/versions/route";
import { GET as getContextProvenanceRoute } from "@/app/api/gea/context/provenance/route";
import { GET as getContextCacheRoute } from "@/app/api/gea/context/cache/route";
import { GET as getContextValidationRoute } from "@/app/api/gea/context/validation/route";

import { handleMemoryReferences } from "@/lib/gea/agent-api";
import {
  handleContext,
  handleContextBuild,
  handleContextCache,
  handleContextHealth,
  handleContextProvenance,
  handleContextReplay,
  handleContextValidation,
  handleContextVersions,
  handleGetMemory,
  handleMemory,
} from "@/lib/gea/memory-api";

describe("gea memory route forwarding", () => {
  it("routes legacy agent memory query to agent-api handler", async () => {
    const response = await getMemoryRoute(new Request("http://localhost/api/gea/memory?agentId=agent-1"));
    expect(response.status).toBe(200);
    expect(handleMemoryReferences).toHaveBeenCalled();
  });

  it("routes registry memory GET/POST to memory-api handler", async () => {
    await getMemoryRoute(new Request("http://localhost/api/gea/memory"));
    await postMemoryRoute(new Request("http://localhost/api/gea/memory", { method: "POST" }));
    expect(handleMemory).toHaveBeenCalledTimes(2);
  });

  it("forwards memory detail and context route handlers", async () => {
    await getMemoryByIdRoute(new Request("http://localhost/api/gea/memory/m-1"), {
      params: Promise.resolve({ id: "m-1" }),
    });
    await getContextRoute(new Request("http://localhost/api/gea/context"));
    await postContextBuildRoute(new Request("http://localhost/api/gea/context/build", { method: "POST" }));
    await postContextReplayRoute(new Request("http://localhost/api/gea/context/replay", { method: "POST" }));
    await getContextHealthRoute(new Request("http://localhost/api/gea/context/health"));
    await getContextVersionsRoute(new Request("http://localhost/api/gea/context/versions"));
    await getContextProvenanceRoute(new Request("http://localhost/api/gea/context/provenance"));
    await getContextCacheRoute(new Request("http://localhost/api/gea/context/cache"));
    await getContextValidationRoute(new Request("http://localhost/api/gea/context/validation"));

    expect(handleGetMemory).toHaveBeenCalled();
    expect(handleContext).toHaveBeenCalled();
    expect(handleContextBuild).toHaveBeenCalled();
    expect(handleContextReplay).toHaveBeenCalled();
    expect(handleContextHealth).toHaveBeenCalled();
    expect(handleContextVersions).toHaveBeenCalled();
    expect(handleContextProvenance).toHaveBeenCalled();
    expect(handleContextCache).toHaveBeenCalled();
    expect(handleContextValidation).toHaveBeenCalled();
  });
});
