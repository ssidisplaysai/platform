jest.mock("server-only", () => ({}));

const originalPersistenceDirectory =
  process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
const testPersistenceDirectory =
  `${process.cwd()}/.gcp-foundation-data-test-${process.env.JEST_WORKER_ID ?? "0"}-n8n-research-provider`;

beforeAll(() => {
  process.env.GCP_FOUNDATION_PERSISTENCE_DIR =
    testPersistenceDirectory;
});

afterAll(() => {
  if (originalPersistenceDirectory === undefined) {
    delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  } else {
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR =
      originalPersistenceDirectory;
  }
});

import {
  createGlwN8nResearchProvider,
  GLW_N8N_RESEARCH_WORKFLOW_ID,
  GLW_N8N_RESEARCH_WORKFLOW_NAME,
  type GlwN8nResearchPayload,
  type GlwN8nResearchTransport,
} from "../n8n-research-provider";
import {
  GLW_N8N_WORKFLOW_ID,
} from "../n8n-draft-adapter";
import {
  GLW_N8N_MCP_RECOVERY_WORKFLOW_ID,
} from "../n8n-mcp-adapter";
import {
  initializeGlwSiteEnrichmentRecord,
  resetGlwSiteEnrichmentRepositoryForTests,
} from "../site-enrichment-repository";
import {
  buildGlwStateServiceResearchPlan,
} from "../site-enrichment-research-planner";
import type {
  GlwResearchExecutionRequest,
} from "../site-enrichment-research-executor";

function request(): GlwResearchExecutionRequest {
  return {
    organizationId: "led-display-warehouse",
    siteId: "site-led-display-warehouse-production",
    campaignId: "campaign-n8n-research-test",
    productId: "prod-indoor-digital-sphere",
    stateCode: "CO",
    canonicalPath:
      "/indoor-digital-sphere/colorado/",
    jobId: "job-colorado-n8n-research",
    wordpressObjectId: "19853",
  };
}

function initialize(): void {
  const executionRequest = request();
  const planned =
    buildGlwStateServiceResearchPlan({
      organizationId:
        executionRequest.organizationId,
      siteId: executionRequest.siteId,
      siteDomain: "leddisplaywarehouse.com",
      productId: executionRequest.productId,
      productTopic: "Indoor LED Sphere",
      campaignId: executionRequest.campaignId,
      stateCode: executionRequest.stateCode,
      stateName: "Colorado",
      canonicalPath:
        executionRequest.canonicalPath,
      jobId: executionRequest.jobId,
      wordpressObjectId:
        executionRequest.wordpressObjectId,
      upstreamAuthorityDomains: [
        "ssidisplays.com",
      ],
    });

  initializeGlwSiteEnrichmentRecord({
    enrichmentId: planned.enrichmentId,
    organizationId: planned.organizationId,
    siteId: planned.siteId,
    productId: planned.productId,
    campaignId: planned.campaignId,
    stateCode: planned.stateCode,
    canonicalPath: planned.canonicalPath,
    jobId: planned.jobId,
    wordpressObjectId:
      planned.wordpressObjectId,
    upstreamAuthorityDomains:
      planned.upstreamAuthorityDomains,
    researchRequirements:
      planned.researchRequirements,
    plan: planned.emptyPlan,
  });
}

function acquisition() {
  return {
    ...request(),
    sources: [
      {
        sourceId: "product-source",
        title: "Indoor Digital Sphere",
        url:
          "https://ssidisplays.com/digital-spheres/",
        domain: "ssidisplays.com",
        tier: "first_party" as const,
        publisher:
          "Screen Solutions International",
        retrievedAt:
          "2026-09-01T09:00:00.000Z",
      },
      {
        sourceId: "state-source",
        title: "State of Colorado",
        url: "https://co.colorado.gov/",
        domain: "co.colorado.gov",
        tier: "government" as const,
        publisher: "State of Colorado",
        retrievedAt:
          "2026-09-01T09:00:00.000Z",
      },
    ],
    claims: [
      {
        claimId: "product-claim",
        claimClass: "product" as const,
        statement:
          "SSI publishes information about indoor digital spheres.",
        evidenceSourceIds: [
          "product-source",
        ],
      },
    ],
    links: [
      {
        linkId: "internal-product",
        kind: "internal" as const,
        href: "/indoor-digital-sphere/",
        anchorText: "Indoor Digital Sphere",
        sourceId: null,
      },
      {
        linkId: "external-state",
        kind: "external_authority" as const,
        href: "https://co.colorado.gov/",
        anchorText: "State of Colorado",
        sourceId: "state-source",
      },
    ],
    fulfillment: {
      "source-product-first-party": {
        sourceIds: ["product-source"],
      },
      "source-state-government": {
        sourceIds: ["state-source"],
      },
      "link-internal-product": {
        linkIds: ["internal-product"],
      },
      "link-external-authority": {
        linkIds: ["external-state"],
      },
    },
  };
}

function transportFor(
  response: unknown,
  inspect?: (payload: GlwN8nResearchPayload) => void,
): GlwN8nResearchTransport {
  return {
    async execute(input) {
      inspect?.(input.payload);
      return response;
    },
  };
}

function providerFor(
  response: unknown,
  inspect?: (payload: GlwN8nResearchPayload) => void,
) {
  return createGlwN8nResearchProvider({
    transport: transportFor(response, inspect),
    resolveAllowedInternalLinks: () => [
      {
        href: "/indoor-digital-sphere/",
        anchorText: "Indoor Digital Sphere",
        authorityClass: "product",
      },
    ],
  });
}

describe("GLW n8n research provider", () => {
  beforeEach(() => {
    resetGlwSiteEnrichmentRepositoryForTests();
    initialize();
  });

  test("uses its dedicated real workflow identity", () => {
    expect(GLW_N8N_RESEARCH_WORKFLOW_NAME)
      .toBe("GLW Enrichment Research Provider v1");
    expect(GLW_N8N_RESEARCH_WORKFLOW_ID)
      .toBe("E3ZgpwAu98DwpUzO");
    expect(GLW_N8N_RESEARCH_WORKFLOW_ID)
      .not.toBe(GLW_N8N_WORKFLOW_ID);
    expect(GLW_N8N_RESEARCH_WORKFLOW_ID)
      .not.toBe(GLW_N8N_MCP_RECOVERY_WORKFLOW_ID);
  });

  test("fails closed when server-side auth is absent", async () => {
    const fetchImpl = jest.fn<typeof fetch>();
    const provider = createGlwN8nResearchProvider({
      environment: {},
      fetchImpl,
    });

    await expect(provider.research(request()))
      .rejects.toThrow(/not configured/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("sends dedicated header auth without exposing it in the body", async () => {
    const secret = "test-only-research-secret";
    const fetchImpl = jest.fn<typeof fetch>(
      async (_url, init) => {
        const headers =
          init?.headers as Record<string, string>;
        expect(
          headers["X-Genesis-Research-Authorization"],
        ).toBe(secret);
        expect(String(init?.body)).not.toContain(secret);
        expect(init?.redirect).toBe("error");
        return new Response(
          JSON.stringify(acquisition()),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      },
    );
    const provider = createGlwN8nResearchProvider({
      environment: {
        GLW_N8N_RESEARCH_WEBHOOK_URL:
          "https://ssiai.app.n8n.cloud/webhook/glw-enrichment-research-provider-v1",
        GLW_N8N_RESEARCH_WEBHOOK_SECRET:
          secret,
      },
      fetchImpl,
      resolveAllowedInternalLinks: () => [
        {
          href: "/indoor-digital-sphere/",
          anchorText: "Indoor Digital Sphere",
          authorityClass: "product",
        },
      ],
    });

    await expect(provider.research(request()))
      .resolves.toMatchObject({
        jobId: request().jobId,
      });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("does not expose auth in execution errors", async () => {
    const secret = "test-only-error-secret";
    const provider = createGlwN8nResearchProvider({
      environment: {
        GLW_N8N_RESEARCH_WEBHOOK_URL:
          "https://ssiai.app.n8n.cloud/webhook/glw-enrichment-research-provider-v1",
        GLW_N8N_RESEARCH_WEBHOOK_SECRET:
          secret,
      },
      fetchImpl: async () => new Response(
        JSON.stringify({ error: secret }),
        { status: 401 },
      ),
    });

    const error = await provider.research(request())
      .catch((value: unknown) => value);
    expect(String(error)).toContain("HTTP 401");
    expect(String(error)).not.toContain(secret);
  });

  test.each([
    "http://example.com/research",
    "https://localhost/research",
    "https://127.0.0.1/research",
    "https://10.0.0.4/research",
    "https://172.16.0.4/research",
    "https://192.168.1.4/research",
    "https://169.254.169.254/latest/meta-data/",
    "https://metadata.google.internal/",
    "https://service.internal/research",
    "https://example.com/research",
  ])("rejects prohibited webhook target %s", async (webhookUrl) => {
    const fetchImpl = jest.fn<typeof fetch>();
    const provider = createGlwN8nResearchProvider({
      environment: {
        GLW_N8N_RESEARCH_WEBHOOK_URL:
          webhookUrl,
        GLW_N8N_RESEARCH_WEBHOOK_SECRET:
          "test-only-secret",
      },
      fetchImpl,
    });

    await expect(provider.research(request()))
      .rejects.toThrow(/HTTPS|prohibited|approved endpoint/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("sends exact identity and bounded requirements", async () => {
    let observed: GlwN8nResearchPayload | null = null;
    const provider = providerFor(
      { output: acquisition() },
      (payload) => {
        observed = payload;
      },
    );

    const result = await provider.research(request());

    expect(result.organizationId)
      .toBe(request().organizationId);
    expect(observed?.workflowId)
      .toBe(GLW_N8N_RESEARCH_WORKFLOW_ID);
    expect(observed?.identity)
      .toEqual(request());
    expect(observed?.request)
      .toEqual(request());
    expect(observed?.researchRequirements.length)
      .toBe(7);
    expect(observed?.researchRequirements.some(
      (requirement) =>
        requirement.requirementId
        === "link-internal-geography",
    )).toBe(false);
    expect(observed?.upstreamAuthorityDomains)
      .toEqual(["ssidisplays.com"]);
    expect(observed?.allowedInternalLinks)
      .toEqual([
        expect.objectContaining({
          href: "/indoor-digital-sphere/",
        }),
      ]);
    expect(observed)
      .not.toHaveProperty("wordpressMutation");
    expect(observed)
      .not.toHaveProperty("publication");
  });

  test("uses the Genesis internal-link authority by default", async () => {
    let observed: GlwN8nResearchPayload | null = null;
    const provider = createGlwN8nResearchProvider({
      transport: transportFor(
        acquisition(),
        (payload) => {
          observed = payload;
        },
      ),
    });

    await expect(provider.research(request()))
      .resolves.toMatchObject({
        jobId: request().jobId,
      });

    expect(observed?.allowedInternalLinks)
      .toEqual([
        {
          href: "/indoor-digital-sphere/",
          anchorText: "Indoor Digital Sphere",
          authorityClass: "product",
        },
      ]);
  });

  test("rejects mismatched response identity", async () => {
    const response = {
      ...acquisition(),
      jobId: "wrong-job",
    };
    await expect(
      providerFor(response).research(request()),
    ).rejects.toThrow(/mismatched execution identity/i);
  });

  test("rejects invalid source domains", async () => {
    const response = acquisition();
    response.sources[0] = {
      ...response.sources[0],
      domain: "example.com",
    };
    await expect(
      providerFor(response).research(request()),
    ).rejects.toThrow(/invalid source/i);
  });

  test("rejects claims with unknown evidence", async () => {
    const response = acquisition();
    response.claims[0] = {
      ...response.claims[0],
      evidenceSourceIds: ["unknown-source"],
    };
    await expect(
      providerFor(response).research(request()),
    ).rejects.toThrow(/unsupported claim/i);
  });

  test("rejects internal links outside the Genesis allow-list", async () => {
    const response = acquisition();
    response.links[0] = {
      ...response.links[0],
      href: "/fabricated-page/",
    };
    await expect(
      providerFor(response).research(request()),
    ).rejects.toThrow(/unapproved internal link/i);
  });

  test("rejects unknown requirement IDs", async () => {
    const response = {
      ...acquisition(),
      fulfillment: {
        ...acquisition().fulfillment,
        "invented-requirement": {
          sourceIds: ["product-source"],
        },
      },
    };
    await expect(
      providerFor(response).research(request()),
    ).rejects.toThrow(/unknown requirement/i);
  });

  test("fails closed on malformed responses", async () => {
    await expect(
      providerFor({ output: "not-json" })
        .research(request()),
    ).rejects.toThrow(/malformed response/i);
  });

  test("propagates bounded n8n execution failures", async () => {
    const transport: GlwN8nResearchTransport = {
      async execute() {
        throw new Error("provider unavailable");
      },
    };
    const provider = createGlwN8nResearchProvider({
      transport,
    });
    await expect(provider.research(request()))
      .rejects.toThrow("provider unavailable");
  });

  test("aborts and reports provider timeouts", async () => {
    jest.useFakeTimers();
    const transport: GlwN8nResearchTransport = {
      execute({ signal }) {
        return new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
          void resolve;
        });
      },
    };
    const provider = createGlwN8nResearchProvider({
      environment: {
        GLW_N8N_RESEARCH_TIMEOUT_MS: "1000",
      },
      transport,
    });
    const result = expect(
      provider.research(request()),
    ).rejects.toThrow(/timed out/i);
    await jest.advanceTimersByTimeAsync(1_000);
    await result;
    jest.useRealTimers();
  });
});
