jest.mock("server-only", () => ({}));

const publish = jest.fn();
const checkpoint = jest.fn((input: { executionPlanId: string; status: string; operations: unknown[] }) => ({ executionPlanId: input.executionPlanId, organizationId: "org", siteId: "site", buildSessionId: "build", authorizationReviewId: "auth", fingerprint: "fingerprint", createdAt: "now", updatedAt: "now", ...input }));
const updateSite = jest.fn();
const inspect = jest.fn();

jest.mock("../wordpress-publish-writer", () => ({ publishGenesisWordPressDraft: (...args: unknown[]) => publish(...args) }));
jest.mock("../site-publication-execution-repository", () => ({ checkpointSitePublicationExecutionPlan: (input: unknown) => checkpoint(input) }));
jest.mock("../site-repository", () => ({ updateSite: (...args: unknown[]) => updateSite(...args) }));
jest.mock("../site-build-wordpress-review", () => ({ inspectSiteBuildWordPressDrafts: (...args: unknown[]) => inspect(...args) }));
jest.mock("../wordpress-credential-resolver", () => ({ resolveWordPressCredentialReference: () => ({ username: "user", applicationPassword: "password" }) }));
jest.mock("../authenticated-wordpress-read-authority", () => ({ normalizeWordPressApiBaseUrl: () => "https://example.test/wp-json/wp/v2" }));
jest.mock("../site-build-service", () => ({ getSiteBuildWorkspace: jest.fn() }));

const pageOperation = (id: number) => ({ operationId: `op-${id}`, kind: "PUBLISH_PAGE" as const, label: `Publish ${id}`, targetId: String(id), currentState: "draft", intendedState: "publish", mutation: true, status: "PENDING" as const, attemptCount: 0, idempotencyKey: `publish-${id}`, completedAt: null, error: null });
const tailOperations = [
  { ...pageOperation(100), operationId: "front", kind: "SET_STATIC_FRONT_PAGE" as const, targetId: "10", idempotencyKey: "front" },
  { ...pageOperation(101), operationId: "verify", kind: "FINAL_VERIFICATION" as const, mutation: false, idempotencyKey: "verify" },
  { ...pageOperation(102), operationId: "genesis", kind: "TRANSITION_GENESIS_SITE" as const, targetId: "site", idempotencyKey: "genesis" },
];
const plan = { executionPlanId: "plan", organizationId: "org", siteId: "site", buildSessionId: "build", authorizationReviewId: "auth", fingerprint: "fingerprint", status: "READY_FOR_EXECUTION" as const, operations: [...Array.from({ length: 9 }, (_, index) => pageOperation(index + 10)), ...tailOperations], createdAt: "now", updatedAt: "now" };
jest.mock("../site-publication-execution-plan", () => ({ prepareSitePublicationExecutionPlan: jest.fn(async () => ({ ready: true, navigation: { mutationRequired: false }, blockers: [], plan })) }));

import { executeSitePublication } from "../site-publication-executor";

describe("site publication executor", () => {
  beforeEach(() => { jest.clearAllMocks(); publish.mockImplementation(async ({ wordpressObjectId }: { wordpressObjectId: string }) => wordpressObjectId === "18" ? { ok: false, state: "write_failed", message: "bounded failure" } : { ok: true, wordpressObjectId, wordpressUrl: null, wordpressStatus: "publish", publicationPerformed: true, alreadyPublished: false }); global.fetch = jest.fn(); });

  test("checkpoints successful pages, stops at failure, and delays front-page and Genesis mutations", async () => {
    const result = await executeSitePublication({ siteId: "site", integrations: { wordpressApiBaseUrl: "https://example.test/wp-json/wp/v2", wordpressCredentialReference: "ref" } } as never);
    expect(result.status).toBe("PARTIALLY_FAILED");
    expect(result.operations.slice(0, 8).every((operation) => operation.status === "SUCCEEDED")).toBe(true);
    expect(result.operations[8]).toMatchObject({ targetId: "18", status: "FAILED", attemptCount: 1 });
    expect(result.operations.find((operation) => operation.kind === "SET_STATIC_FRONT_PAGE")?.status).toBe("PENDING");
    expect(publish.mock.calls.map(([input]) => input.wordpressObjectId)).toEqual(["10", "11", "12", "13", "14", "15", "16", "17", "18"]);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(updateSite).not.toHaveBeenCalled();
  });
});
