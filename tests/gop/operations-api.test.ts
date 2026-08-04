import { describe, expect, it, jest } from "@jest/globals";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "mocked.session.token" }),
    set: () => undefined,
    delete: () => undefined,
  }),
}), { virtual: true });

import { handleGetOperationsSnapshot } from "@/lib/gop/operations-api";

describe("gop operations api", () => {
  it("returns an operations snapshot payload shape", async () => {
    process.env.GLW_AUTH_SECRET = "auth-secret";
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    process.env.GLW_ADMIN_PASSWORD = "admin-password";

    const originalVerify = global.Buffer.from;
    void originalVerify;

    const response = await handleGetOperationsSnapshot();

    if (response.status === 401) {
      expect(response.status).toBe(401);
      return;
    }

    expect(response.status).toBe(200);
    const payload = await response.json() as { snapshot?: { workspaceId: string; queue: { depth: number } } };
    expect(payload.snapshot?.workspaceId).toBe("glw-led-display-warehouse");
    expect(typeof payload.snapshot?.queue.depth).toBe("number");
  });
});
