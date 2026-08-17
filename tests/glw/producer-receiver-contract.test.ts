import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { deriveGlwCallbackIdentity, hashCanonicalGlwCallbackPayload } from "@/lib/glw/callback-idempotency";
import { buildGlwProducerTerminalPayload } from "@/lib/glw/producer-callback-contract";

type Workflow = {
  id: string;
  name: string;
  nodes: Array<{ name: string; type: string; parameters: Record<string, unknown>; credentials?: unknown }>;
  connections: Record<string, { main: Array<Array<{ node: string }>> }>;
  activeVersion?: Workflow;
};

const workflowPath = join(process.cwd(), "backups/n8n/glw-page-engine-v1.0.json");
const workflowText = readFileSync(workflowPath, "utf8");
const workflow = JSON.parse(workflowText) as Workflow;
const workflowCopies = [workflow, workflow.activeVersion!];

function nodes(copy: Workflow, type?: string) {
  return copy.nodes.filter((node) => !type || node.type === type);
}

describe("HR-004 Slice C producer/receiver and n8n contract", () => {
  it("preserves the exact non-production workflow artifact identity", () => {
    expect(workflow).toMatchObject({ id: "bIDXxyWnY22G8zJC", name: "Master SEO Page Engine v1.0 - PRODUCTION" });
    expect(workflowCopies).toHaveLength(2);
  });

  it("propagates operation and publication identity in both workflow copies", () => {
    for (const copy of workflowCopies) {
      const builder = copy.nodes.find((node) => node.name === "Build GLW Producer Completion Envelope");
      expect(builder?.type).toBe("n8n-nodes-base.code");
      expect(String(builder?.parameters.jsCode)).toContain("request.operationKey");
      expect(String(builder?.parameters.jsCode)).toContain("request.publicationKey");
    }
  });

  it("constructs the Slice B v2 key, scope, and hash in both workflow copies", () => {
    for (const copy of workflowCopies) {
      const code = String(copy.nodes.find((node) => node.name === "Build GLW Producer Completion Envelope")?.parameters.jsCode);
      expect(code).toContain("glw-callback-v2:");
      expect(code).toContain("glw-terminal-v2:");
      expect(code).toContain("createHash('sha256')");
      expect(code).toContain("callbackVersion: '2'");
    }
  });

  it("contains one PostgreSQL enqueue node in each workflow copy", () => {
    for (const copy of workflowCopies) {
      const enqueue = copy.nodes.find((node) => node.name === "Enqueue GLW Producer Completion");
      expect(enqueue?.type).toBe("n8n-nodes-base.postgres");
      expect(String(enqueue?.parameters.query)).toContain("enqueueGlwProducerCompletion");
    }
  });

  it("requires SERIALIZABLE producer transactions in both workflow copies", () => {
    for (const copy of workflowCopies) {
      const query = String(copy.nodes.find((node) => node.name === "Enqueue GLW Producer Completion")?.parameters.query);
      expect(query).toContain("BEGIN ISOLATION LEVEL SERIALIZABLE");
      expect(query).toContain("COMMIT");
    }
  });

  it("routes successful GLW completion from builder to enqueue", () => {
    for (const copy of workflowCopies) {
      const builderTargets = copy.connections["Build GLW Producer Completion Envelope"].main.flat().map((edge) => edge.node);
      expect(builderTargets).toEqual(["Enqueue GLW Producer Completion"]);
      expect(copy.connections["GLW Request?"].main[0][0].node).toBe("Build GLW Producer Completion Envelope");
    }
  });

  it("routes both terminal failure branches through the producer builder", () => {
    for (const copy of workflowCopies) {
      const connectionText = JSON.stringify(copy.connections);
      expect(connectionText).not.toContain('"node":"Send GLW Failure Callback"');
      expect(connectionText.match(/Build GLW Producer Completion Envelope/g)?.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("has no active GLW callback HTTP delivery node", () => {
    for (const copy of workflowCopies) {
      const callbackHttpNodes = nodes(copy, "n8n-nodes-base.httpRequest").filter((node) => /callback/i.test(node.name));
      expect(callbackHttpNodes).toEqual([]);
      expect(copy.nodes.find((node) => node.name === "Legacy GLW Failure Callback Disabled")?.type).toBe("n8n-nodes-base.noOp");
    }
  });

  it("contains no Slice D delivery, retry, lease, or dead-letter node", () => {
    for (const copy of workflowCopies) {
      expect(copy.nodes.filter((node) => /dispatch|retry|lease|claim|dead.?letter|acknowledge/i.test(node.name))).toEqual([]);
    }
  });

  it("does not embed a producer PostgreSQL credential", () => {
    for (const copy of workflowCopies) {
      const enqueue = copy.nodes.find((node) => node.name === "Enqueue GLW Producer Completion");
      expect(enqueue).not.toHaveProperty("credentials");
    }
    expect(workflowText).not.toMatch(/postgres(?:ql)?:\/\//i);
  });

  it("matches Slice B for a COMPLETE callback vector", () => {
    const payload = buildGlwProducerTerminalPayload({
      jobId: "job-complete",
      executionId: "execution-complete",
      status: "COMPLETE",
      title: "Complete",
      wordpressPageId: 12004,
      wordpressPostId: 12004,
      wordpressUrl: "https://example.test/complete/",
      wordpressStatus: "publish",
      requestedPublishingMode: "publish",
    }, "glw-op-v1:complete");
    expect(deriveGlwCallbackIdentity(payload)).toMatchObject({
      idempotencyKey: payload.idempotencyKey,
      terminalScopeKey: payload.terminalScopeKey,
      payloadSha256: payload.payloadSha256,
    });
  });

  it("matches Slice B for FAILED and FAILED_QA callback vectors", () => {
    for (const status of ["FAILED", "FAILED_QA"] as const) {
      const payload = buildGlwProducerTerminalPayload({
        jobId: `job-${status}`,
        executionId: `execution-${status}`,
        status,
        error: { code: status, message: "failed", step: "qa" },
      }, `glw-op-v1:${status}`);
      expect(deriveGlwCallbackIdentity(payload).payloadSha256).toBe(payload.payloadSha256);
    }
  });

  it("uses the same canonical hash regardless of semantic object key insertion order", () => {
    const left = buildGlwProducerTerminalPayload({ jobId: "job", executionId: "execution", status: "FAILED", error: { message: "failed", code: "E" } }, "glw-op-v1:order");
    const right = buildGlwProducerTerminalPayload({ status: "FAILED", executionId: "execution", jobId: "job", error: { code: "E", message: "failed" } }, "glw-op-v1:order");
    expect(left.payloadSha256).toBe(right.payloadSha256);
    expect(hashCanonicalGlwCallbackPayload(left).payloadSha256).toBe(left.payloadSha256);
  });

  it("executes the exported n8n builder with the exact shared contract result", () => {
    const code = String(workflow.nodes.find((node) => node.name === "Build GLW Producer Completion Envelope")?.parameters.jsCode);
    const values: Record<string, Record<string, unknown>> = {
      "Get row(s) in sheet": { job_id: "job-1" },
      "GLW Page Webhook": { body: { operationKey: "glw-op-v1:operation-1", publicationKey: "glw-publication-v1:publication-1" } },
      "Build Pre-Publish QA Result": {
        job_id: "job-1",
        qa_callback_status: "COMPLETE",
        qa_title: "Complete",
        qa_wordpress_url: "https://example.test/complete/",
        qa_page_id: 12004,
        qa_wordpress_status: "publish",
        qa_disposition: "CREATED",
        qa_checks: { pageExists: "PASS" },
        qa_failure_reasons: {},
      },
      "Normalize Published City Page": { requested_publishing_mode: "publish" },
    };
    const lookup = (name: string) => ({ first: () => ({ json: values[name] }) });
    const execute = new Function("$", "$json", "$execution", "require", code) as (
      lookupNode: typeof lookup,
      current: Record<string, unknown>,
      execution: { id: string },
      requireModule: NodeRequire,
    ) => Array<{ json: { callback_payload: Record<string, unknown> } }>;
    const actual = execute(lookup, {}, { id: "execution-1" }, createRequire(join(process.cwd(), "package.json")))[0].json.callback_payload;
    const expected = buildGlwProducerTerminalPayload({
      jobId: "job-1",
      executionId: "execution-1",
      status: "COMPLETE",
      title: "Complete",
      wordpressUrl: "https://example.test/complete/",
      wordpressPostId: 12004,
      wordpressPageId: 12004,
      wordpressStatus: "publish",
      requestedPublishingMode: "publish",
      disposition: "CREATED",
      qaChecks: { pageExists: "PASS" },
      qaFailureReasons: {},
    }, "glw-op-v1:operation-1");
    expect(actual).toEqual(expected);
  });
});