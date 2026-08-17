import { describe, expect, it, jest } from "@jest/globals";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/glw/auth", () => ({
  getGlwSession: async () => ({
    email: "admin@example.com",
    expiresAt: Date.now() + 60_000,
  }),
}));
jest.mock("@/platform/gop/runtime/orchestration-runtime", () => ({
  getGenesisOrchestrationRuntime: () => ({
    buildOperationsSnapshot: async () => ({
      workspaceId: "glw-led-display-warehouse",
      queue: { depth: 0 },
    }),
  }),
}));
jest.mock("@/platform/gop/runtime/event-store", () => ({
  getGenesisEventStore: () => ({}),
}));

import { handleGetOperationsSnapshot } from "@/lib/gop/operations-api";

describe("gop operations api", () => {
  it("returns an operations snapshot payload shape", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";

    const originalVerify = global.Buffer.from;
    void originalVerify;

    const response = await handleGetOperationsSnapshot();

    expect(response.status).toBe(200);
    const payload = await response.json() as { snapshot?: { workspaceId: string; queue: { depth: number } } };
    expect(payload.snapshot?.workspaceId).toBe("glw-led-display-warehouse");
    expect(typeof payload.snapshot?.queue.depth).toBe("number");
  });
});
