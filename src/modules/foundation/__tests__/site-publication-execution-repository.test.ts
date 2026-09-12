import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("site publication execution repository", () => {
  const prior = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let directory: string;
  beforeEach(() => { jest.resetModules(); directory = fs.mkdtempSync(path.join(os.tmpdir(), "publication-execution-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = directory; });
  afterEach(() => { process.env.GCP_FOUNDATION_PERSISTENCE_DIR = prior; fs.rmSync(directory, { recursive: true, force: true }); });

  test("creates an idempotent plan and preserves immutable operation identities across checkpoints", async () => {
    const repository = await import("../site-publication-execution-repository");
    const input = { organizationId: "org", siteId: "site", buildSessionId: "build", authorizationReviewId: "authorization", operations: [{ kind: "PUBLISH_PAGE" as const, label: "Publish Home", targetId: "10", currentState: "draft", intendedState: "publish", mutation: true, idempotencyKey: "publish-10" }, { kind: "FINAL_VERIFICATION" as const, label: "Verify", targetId: "site", currentState: "pending", intendedState: "verified", mutation: false, idempotencyKey: "verify-site" }] };
    const first = repository.saveSitePublicationExecutionPlan(input);
    expect(repository.saveSitePublicationExecutionPlan(input).executionPlanId).toBe(first.executionPlanId);
    const operations = first.operations.map((operation, index) => index === 0 ? { ...operation, status: "SUCCEEDED" as const, attemptCount: 1, completedAt: "2026-09-11T00:00:00.000Z" } : operation);
    const checkpoint = repository.checkpointSitePublicationExecutionPlan({ executionPlanId: first.executionPlanId, status: "EXECUTING", operations });
    expect(checkpoint.status).toBe("EXECUTING");
    expect(checkpoint.operations[0]).toMatchObject({ operationId: first.operations[0].operationId, idempotencyKey: "publish-10", status: "SUCCEEDED" });
    expect(repository.createSitePublicationExecutionFingerprint(first.operations)).toBe(repository.createSitePublicationExecutionFingerprint(first.operations.map((operation) => ({ ...operation, currentState: "publish" }))));
  });
});
