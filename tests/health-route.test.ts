/** @jest-environment node */
import { GET, HEAD } from "@/app/api/health/route";

describe("/api/health", () => {
  it("returns a minimal non-sensitive 200 body", async () => {
    process.env.GENESIS_WOOCOMMERCE_WEBHOOK_SECRET = "must-not-leak";
    const res = GET();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ status: "ok" });
    expect(text).not.toContain("must-not-leak");
    delete process.env.GENESIS_WOOCOMMERCE_WEBHOOK_SECRET;
  });

  it("supports HEAD", () => {
    expect(HEAD().status).toBe(200);
  });
});
