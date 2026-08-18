import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";

describe("HR-004 Slice E operations and worker end-to-end structure", () => {
  it("keeps worker inactive", async () => expect(JSON.parse(await readFile(join(process.cwd(), "backups/n8n/glw-callback-delivery-worker.json"), "utf8")).active).toBe(false));
  it("adds approved recovery discovery through unified claim", async () => expect(await readFile(join(process.cwd(), "backups/n8n/glw-callback-delivery-worker.json"), "utf8")).toContain("claimGlwProducerDeliveryWork"));
  it("preserves one stored-body HTTP transport node", async () => {
    const workflow = JSON.parse(await readFile(join(process.cwd(), "backups/n8n/glw-callback-delivery-worker.json"), "utf8"));
    expect(workflow.nodes.filter((node: { type: string }) => node.type === "n8n-nodes-base.httpRequest")).toHaveLength(1);
  });
  it("keeps exact stored payload expression", async () => expect(await readFile(join(process.cwd(), "backups/n8n/glw-callback-delivery-worker.json"), "utf8")).toContain("requestBodyUtf8"));
  it("contains no payload regeneration", async () => expect(await readFile(join(process.cwd(), "backups/n8n/glw-callback-delivery-worker.json"), "utf8")).not.toMatch(/canonicalize|regenerate|build.*payload/i));
  it("contains no separate alert transport", async () => expect(await readFile(join(process.cwd(), "backups/n8n/glw-callback-delivery-worker.json"), "utf8")).not.toMatch(/slack|pagerduty|teams|email/i));
  it("uses encrypted credential reference only", async () => {
    const text = await readFile(join(process.cwd(), "backups/n8n/glw-callback-delivery-worker.json"), "utf8");
    expect(text).toContain("Genesis GLW Callback Auth 9A17");
    expect(text).not.toMatch(/Bearer\s+[^\s"']{12,}/i);
  });
  it("prepares heartbeat and deterministic visibility before claim", async () => expect(await readFile(join(process.cwd(), "backups/n8n/glw-callback-delivery-worker.json"), "utf8")).toContain("prepareGlwProducerDeliveryWork"));
  it("keeps the certified six-node worker shape", async () => expect(JSON.parse(await readFile(join(process.cwd(), "backups/n8n/glw-callback-delivery-worker.json"), "utf8")).nodes).toHaveLength(6));
  it("uses unified begin and complete functions", async () => {
    const text = await readFile(join(process.cwd(), "backups/n8n/glw-callback-delivery-worker.json"), "utf8");
    expect(text).toContain("beginGlwProducerDeliveryWork");
    expect(text).toContain("completeGlwProducerDeliveryWork");
  });
  it("operator API route has no callback transport", async () => expect(await readFile(join(process.cwd(), "src/app/api/glw/callback-deliveries/route.ts"), "utf8")).not.toMatch(/fetch\(|sendGlwDeliveryRequest|GLW_CALLBACK/));
  it("operator panel never renders raw callback payload", async () => expect(await readFile(join(process.cwd(), "src/components/glw/callback-delivery-operations-panel.tsx"), "utf8")).not.toMatch(/requestBodyUtf8|canonicalPayload|Authorization\s*:/i));
});
