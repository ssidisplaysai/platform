import {
  buildSiteIntelligenceProviderRequestV1,
  parseSiteIntelligenceProviderResponseV1,
  SITE_INTELLIGENCE_PROVIDER_CONTRACT_VERSION,
  SITE_INTELLIGENCE_PROVIDER_ID,
} from "../site-intelligence-provider-contract";
import { createSiteIntelligenceN8nProvider } from "../site-intelligence-n8n-provider";

const publicDns = { resolveHost: async () => [{ address: "93.184.216.34", family: 4 }] };

function request(mode: "INITIAL" | "OPPORTUNITY_CONTINUATION" = "INITIAL") {
  return buildSiteIntelligenceProviderRequestV1({
    executionId: "execution-1",
    executionMode: mode,
    organizationId: "organization-1",
    siteId: "site-1",
    domain: "example.com",
    publicBrandIdentity: "Example",
    brandProfileId: "brand-1",
    seoProfileId: "seo-1",
    promptProfileId: "prompt-1",
    imageProfileId: "image-1",
    focusOpportunityId: mode === "INITIAL" ? null : "opportunity-1",
  });
}

function validResponse() {
  return {
    contractVersion: SITE_INTELLIGENCE_PROVIDER_CONTRACT_VERSION,
    provider: {
      providerId: SITE_INTELLIGENCE_PROVIDER_ID,
      providerExecutionId: "provider-execution-1",
      completedAt: "2026-09-10T00:00:00.000Z",
    },
    organizationId: "organization-1",
    siteId: "site-1",
    executionId: "execution-1",
    evidence: [{
      evidenceId: "evidence-1",
      sourceReference: "https://competitor.example/research",
      sourceType: "WEB",
      observedClaim: "Observed market positioning.",
      retrievedAt: "2026-09-10T00:00:00.000Z",
      entity: "Competitor",
      confidence: 0.7,
      strength: "MODERATE",
      authority: "OBSERVATION",
    }],
    opportunities: [{
      opportunityId: "opportunity-1",
      name: "Candidate niche",
      category: "niche",
      buyer: "buyer",
      problemUseCase: "use case",
      commercialValue: "UNKNOWN",
      demandSignal: "observed",
      competitionLevel: "UNKNOWN",
      organizationFit: "UNKNOWN",
      evidenceStrength: "MODERATE",
      confidence: 0.7,
      geographicScope: "unknown",
      nationalRolloutPotential: false,
      recurringReplacementPotential: false,
      seoContentOpportunity: "candidate",
      rationale: "inference",
      competitorEntities: ["Competitor"],
      evidenceIds: ["evidence-1"],
      capabilityState: "OWNER_VALIDATION_REQUIRED",
      capabilityEvidenceIds: [],
      capabilityNotes: null,
      recommendation: "review",
      ownerDecision: "PENDING",
      decidedBy: null,
      decidedAt: null,
    }],
  };
}

describe("SITE_INTELLIGENCE_PROVIDER_CONTRACT_V1", () => {
  test("constructs an explicit immutable initial request", () => {
    expect(request()).toEqual(expect.objectContaining({
      contractVersion: "SITE_INTELLIGENCE_PROVIDER_CONTRACT_V1",
      workflowId: "genesis-site-intelligence-v1",
      executionMode: "INITIAL",
      focusOpportunityId: null,
    }));
  });

  test("requires execution mode and focus opportunity consistency", () => {
    const base = request();
    expect(() => buildSiteIntelligenceProviderRequestV1({
      ...base.authority,
      executionId: base.identity.executionId,
      executionMode: "UNBOUNDED" as never,
      focusOpportunityId: null,
    })).toThrow("RESEARCH_PROVIDER_CONTRACT_MISMATCH:execution_mode");
    expect(() => buildSiteIntelligenceProviderRequestV1({
      ...base.authority,
      executionId: base.identity.executionId,
      executionMode: "INITIAL",
      focusOpportunityId: "opportunity-1",
    })).toThrow("RESEARCH_PROVIDER_CONTRACT_MISMATCH:execution_mode_focus");
    expect(() => buildSiteIntelligenceProviderRequestV1({
      ...base.authority,
      executionId: base.identity.executionId,
      executionMode: "OPPORTUNITY_CONTINUATION",
      focusOpportunityId: null,
    })).toThrow("RESEARCH_PROVIDER_CONTRACT_MISMATCH:execution_mode_focus");
  });

  test("accepts an exact bounded response", async () => {
    const parsed = await parseSiteIntelligenceProviderResponseV1(validResponse(), request(), publicDns);
    expect(parsed.provider.providerExecutionId).toBe("provider-execution-1");
    expect(parsed.opportunities[0].evidenceIds).toEqual(["evidence-1"]);
  });

  test.each([
    ["contract version", (value: ReturnType<typeof validResponse>) => { value.contractVersion = "V2" as never; }, "RESEARCH_PROVIDER_CONTRACT_MISMATCH:contractVersion"],
    ["provider", (value: ReturnType<typeof validResponse>) => { value.provider.providerId = "other" as never; }, "RESEARCH_PROVIDER_CONTRACT_MISMATCH:providerId"],
    ["organization identity", (value: ReturnType<typeof validResponse>) => { value.organizationId = "other"; }, "RESEARCH_PROVIDER_IDENTITY_MISMATCH:identity"],
    ["site identity", (value: ReturnType<typeof validResponse>) => { value.siteId = "other"; }, "RESEARCH_PROVIDER_IDENTITY_MISMATCH:identity"],
    ["execution identity", (value: ReturnType<typeof validResponse>) => { value.executionId = "other"; }, "RESEARCH_PROVIDER_IDENTITY_MISMATCH:identity"],
  ])("rejects a mismatched %s", async (_name, mutate, error) => {
    const value = validResponse(); mutate(value);
    await expect(parseSiteIntelligenceProviderResponseV1(value, request(), publicDns)).rejects.toThrow(error);
  });

  test.each([
    ["root", (value: ReturnType<typeof validResponse>) => { (value as unknown as Record<string, unknown>).extra = true; }],
    ["provider", (value: ReturnType<typeof validResponse>) => { (value.provider as unknown as Record<string, unknown>).extra = true; }],
    ["evidence", (value: ReturnType<typeof validResponse>) => { (value.evidence[0] as unknown as Record<string, unknown>).extra = true; }],
    ["opportunity", (value: ReturnType<typeof validResponse>) => { (value.opportunities[0] as unknown as Record<string, unknown>).extra = true; }],
  ])("rejects unexpected %s fields", async (_name, mutate) => {
    const value = validResponse(); mutate(value);
    await expect(parseSiteIntelligenceProviderResponseV1(value, request(), publicDns)).rejects.toThrow("RESEARCH_PROVIDER_RESPONSE_INVALID");
  });

  test("rejects duplicate IDs and unknown evidence references", async () => {
    const duplicateEvidence = validResponse(); duplicateEvidence.evidence.push({ ...duplicateEvidence.evidence[0] });
    await expect(parseSiteIntelligenceProviderResponseV1(duplicateEvidence, request(), publicDns)).rejects.toThrow("duplicate_evidence_id");
    const duplicateOpportunity = validResponse(); duplicateOpportunity.opportunities.push({ ...duplicateOpportunity.opportunities[0] });
    await expect(parseSiteIntelligenceProviderResponseV1(duplicateOpportunity, request(), publicDns)).rejects.toThrow("duplicate_opportunity_id");
    const unknown = validResponse(); unknown.opportunities[0].evidenceIds = ["missing"];
    await expect(parseSiteIntelligenceProviderResponseV1(unknown, request(), publicDns)).rejects.toThrow("unknown_evidence_reference");
  });

  test.each([
    ["confidence", (value: ReturnType<typeof validResponse>) => { value.evidence[0].confidence = 1.1; }],
    ["enum", (value: ReturnType<typeof validResponse>) => { value.opportunities[0].competitionLevel = "CERTAIN" as never; }],
    ["timestamp", (value: ReturnType<typeof validResponse>) => { value.evidence[0].retrievedAt = "today"; }],
    ["empty string", (value: ReturnType<typeof validResponse>) => { value.opportunities[0].name = "  "; }],
  ])("rejects invalid %s", async (_name, mutate) => {
    const value = validResponse(); mutate(value);
    await expect(parseSiteIntelligenceProviderResponseV1(value, request(), publicDns)).rejects.toThrow("RESEARCH_PROVIDER_RESPONSE_INVALID");
  });

  test("rejects unsafe source URLs before accepting evidence", async () => {
    const value = validResponse(); value.evidence[0].sourceReference = "https://internal.example/research";
    await expect(parseSiteIntelligenceProviderResponseV1(value, request(), { resolveHost: async () => [{ address: "10.0.0.8", family: 4 }] })).rejects.toThrow("sourceReference_private");
  });

  test("rejects provider attempts to claim owner-supplied authority", async () => {
    const value = validResponse(); value.evidence[0].authority = "OWNER_SUPPLIED_AUTHORITY" as never;
    await expect(parseSiteIntelligenceProviderResponseV1(value, request(), publicDns)).rejects.toThrow("provider_owner_authority_forbidden");
  });

  test("enforces nonempty and maximum collection bounds", async () => {
    const empty = validResponse(); empty.evidence = [];
    await expect(parseSiteIntelligenceProviderResponseV1(empty, request(), publicDns)).rejects.toThrow("evidence_bounds");
    const oversized = validResponse(); oversized.opportunities = Array.from({ length: 26 }, (_, index) => ({ ...oversized.opportunities[0], opportunityId: `opportunity-${index}` }));
    await expect(parseSiteIntelligenceProviderResponseV1(oversized, request(), publicDns)).rejects.toThrow("opportunity_bounds");
  });
});

describe("site intelligence n8n contract boundary", () => {
  const environment = {
    GENESIS_SITE_INTELLIGENCE_WEBHOOK_URL: "https://ssiai.app.n8n.cloud/webhook/genesis-site-intelligence-v1",
    GENESIS_SITE_INTELLIGENCE_WEBHOOK_SECRET: "secret",
  } as NodeJS.ProcessEnv;

  function executionInput() {
    const expected = request();
    return {
      executionId: expected.identity.executionId,
      executionMode: expected.executionMode,
      authority: expected.authority,
      focusOpportunityId: expected.focusOpportunityId,
      signal: new AbortController().signal,
    };
  }

  test("sends the exact versioned request and accepts a strict response", async () => {
    const fetchImpl = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const sent = JSON.parse(String(init?.body));
      expect(sent).toMatchObject({
        contractVersion: "SITE_INTELLIGENCE_PROVIDER_CONTRACT_V1",
        executionMode: "INITIAL",
        focusOpportunityId: null,
      });
      expect(Object.keys(sent)).toEqual(["contractVersion", "workflowId", "executionMode", "identity", "authority", "focusOpportunityId", "objectives"]);
      return new Response(JSON.stringify(validResponse()), { status: 200, headers: { "content-type": "application/json" } });
    });
    const provider = createSiteIntelligenceN8nProvider({ environment, fetchImpl: fetchImpl as typeof fetch, contractDependencies: publicDns });
    await expect(provider.execute(executionInput())).resolves.toMatchObject({ executionId: "execution-1", evidence: [{ evidenceId: "evidence-1" }] });
  });

  test("rejects malformed JSON with a stable error", async () => {
    const provider = createSiteIntelligenceN8nProvider({ environment, fetchImpl: (async () => new Response("{not-json", { status: 200 })) as typeof fetch });
    await expect(provider.execute(executionInput())).rejects.toThrow("RESEARCH_PROVIDER_RESPONSE_INVALID:malformed_json");
  });

  test("rejects a declared oversized response before reading it", async () => {
    const provider = createSiteIntelligenceN8nProvider({ environment, fetchImpl: (async () => new Response("{}", { status: 200, headers: { "content-length": "1000001" } })) as typeof fetch });
    await expect(provider.execute(executionInput())).rejects.toThrow("RESEARCH_PROVIDER_RESPONSE_TOO_LARGE");
  });

  test("rejects streamed response bytes over the hard limit", async () => {
    const provider = createSiteIntelligenceN8nProvider({ environment, fetchImpl: (async () => new Response("x".repeat(1_000_001), { status: 200 })) as typeof fetch });
    await expect(provider.execute(executionInput())).rejects.toThrow("RESEARCH_PROVIDER_RESPONSE_TOO_LARGE");
  });
});