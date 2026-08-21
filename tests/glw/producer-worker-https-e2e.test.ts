import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";

describe("HR-004 HTTPS Slice D replacement structure", () => {
  async function workflow() { return JSON.parse(await readFile(join(process.cwd(), "backups/n8n/glw-callback-delivery-worker-https.json"), "utf8")); }

  it("is inactive and retains success and error executions", async () => {
    const value = await workflow();
    expect(value.active).toBe(false);
    expect(value.settings).toMatchObject({ saveDataErrorExecution: "all", saveDataSuccessExecution: "all" });
  });
  it("contains no Postgres nodes or producer database credentials", async () => {
    const value = await workflow();
    expect(value.nodes.filter((node: { type: string }) => node.type === "n8n-nodes-base.postgres")).toHaveLength(0);
    expect(JSON.stringify(value)).not.toMatch(/Genesis GLW Producer PostgreSQL|d5TxS6A83tUSPvYj/);
  });
  it("contains exactly three bounded worker command nodes", async () => {
    const value = await workflow();
    const commandNodes = value.nodes.filter((node: { parameters?: { url?: string } }) => node.parameters?.url?.includes("callback-delivery-worker"));
    expect(commandNodes).toHaveLength(3);
    expect(commandNodes.map((node: { parameters: { url: string } }) => node.parameters.url).join(" ")).toMatch(/cycles/);
    expect(commandNodes.map((node: { parameters: { url: string } }) => node.parameters.url).join(" ")).toMatch(/attempts\/begin/);
    expect(commandNodes.map((node: { parameters: { url: string } }) => node.parameters.url).join(" ")).toMatch(/attempts\/complete/);
  });
  it("contains exactly one callback transport path", async () => {
    const value = await workflow();
    const callbackNodes = value.nodes.filter((node: { parameters?: { url?: string } }) => node.parameters?.url === "={{ $vars.GLW_CALLBACK_DELIVERY_URL }}");
    expect(callbackNodes).toHaveLength(1);
    expect(callbackNodes[0].credentials.httpHeaderAuth.id).toBe("GwQIWWAN3paojT0i");
  });
  it("uses only the dedicated worker API credential for command nodes", async () => {
    const value = await workflow();
    const commandNodes = value.nodes.filter((node: { parameters?: { url?: string } }) => node.parameters?.url?.includes("callback-delivery-worker"));
    expect(new Set(commandNodes.map((node: { credentials: { httpHeaderAuth: { id: string } } }) => node.credentials.httpHeaderAuth.id))).toEqual(new Set(["hr004-producer-worker-api-auth"]));
  });
  it("retries each producer command in-place with the same execution command identity", async () => {
    const value = await workflow();
    const commandNodes = value.nodes.filter((node: { parameters?: { url?: string } }) => node.parameters?.url?.includes("callback-delivery-worker"));
    expect(commandNodes.every((node: { retryOnFail?: boolean; maxTries?: number; waitBetweenTries?: number }) => node.retryOnFail && node.maxTries === 3 && node.waitBetweenTries === 1000)).toBe(true);
    expect(commandNodes.every((node: { parameters: { body: string } }) => node.parameters.body.includes("$execution.id"))).toBe(true);
  });
  it("stops cleanly on an empty worker-cycle result", async () => {
    const value = await workflow();
    const expansion = value.nodes.find((node: { id: string }) => node.id === "expand-claims");
    expect(expansion.parameters.jsCode).toContain("return items.map");
    expect(expansion.parameters.jsCode).toContain("Array.isArray($json.items)");
  });
  it("contains no raw credential-shaped values", async () => {
    const raw = await readFile(join(process.cwd(), "backups/n8n/glw-callback-delivery-worker-https.json"), "utf8");
    expect(raw).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{8,}|postgres(?:ql)?:\/\//i);
  });
});