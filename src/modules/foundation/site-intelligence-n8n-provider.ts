import "server-only";

import type { SiteResearchProvider } from "./site-intelligence-research-executor";
import {
  buildSiteIntelligenceProviderRequestV1,
  failSiteIntelligenceProviderContract,
  MAX_RESPONSE_BYTES,
  parseSiteIntelligenceProviderResponseV1,
  SITE_INTELLIGENCE_PROVIDER_ID,
  type ProviderContractDependencies,
} from "./site-intelligence-provider-contract";

const HOST = "ssiai.app.n8n.cloud";
const PATH = "/webhook/genesis-site-intelligence-v1";
const PRIMARY_CONFIGURATION_KEYS = {
  url: "GENESIS_SITE_INTELLIGENCE_WEBHOOK_URL",
  secret: "GENESIS_SITE_INTELLIGENCE_WEBHOOK_SECRET",
} as const;
const LEGACY_SHARED_CONFIGURATION_KEYS = {
  url: "GLW_N8N_RESEARCH_WEBHOOK_URL",
  secret: "GLW_N8N_RESEARCH_WEBHOOK_SECRET",
} as const;

type ProviderConfigurationSource =
  | "genesis-site-intelligence-webhook"
  | "legacy-shared-research-webhook";

function configuration(environment: NodeJS.ProcessEnv = process.env) {
  const candidates: ReadonlyArray<{
    source: ProviderConfigurationSource;
    url: string;
    secret: string;
  }> = [
    {
      source: "genesis-site-intelligence-webhook",
      url: environment[PRIMARY_CONFIGURATION_KEYS.url]?.trim() ?? "",
      secret: environment[PRIMARY_CONFIGURATION_KEYS.secret]?.trim() ?? "",
    },
    {
      source: "legacy-shared-research-webhook",
      url: environment[LEGACY_SHARED_CONFIGURATION_KEYS.url]?.trim() ?? "",
      secret: environment[LEGACY_SHARED_CONFIGURATION_KEYS.secret]?.trim() ?? "",
    },
  ];

  const candidate = candidates.find((item) => item.url && item.secret);
  if (!candidate) return null;
  const url = new URL(candidate.url);
  if (url.protocol !== "https:" || url.hostname !== HOST || url.pathname !== PATH || url.username || url.password || url.search || url.hash) throw new Error("SITE_INTELLIGENCE_PROVIDER_ENDPOINT_INVALID");
  return { url: url.toString(), secret: candidate.secret, source: candidate.source };
}

export function getSiteIntelligenceProviderStatus(environment: NodeJS.ProcessEnv = process.env) {
  const resolved = configuration(environment);
  return {
    configured: Boolean(resolved),
    providerId: SITE_INTELLIGENCE_PROVIDER_ID,
    endpointAuthority: `${HOST}${PATH}`,
    configurationSource: resolved?.source ?? null,
  };
}

async function boundedJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) failSiteIntelligenceProviderContract("RESEARCH_PROVIDER_RESPONSE_TOO_LARGE", "declared_bytes");
  if (!response.body) failSiteIntelligenceProviderContract("RESEARCH_PROVIDER_RESPONSE_INVALID", "empty_body");
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let byteCount = 0; let body = "";
  while (true) {
    const chunk = await reader.read(); if (chunk.done) break;
    byteCount += chunk.value.byteLength;
    if (byteCount > MAX_RESPONSE_BYTES) { await reader.cancel(); failSiteIntelligenceProviderContract("RESEARCH_PROVIDER_RESPONSE_TOO_LARGE", "streamed_bytes"); }
    body += decoder.decode(chunk.value, { stream: true });
  }
  body += decoder.decode();
  try { return JSON.parse(body) as unknown; } catch { failSiteIntelligenceProviderContract("RESEARCH_PROVIDER_RESPONSE_INVALID", "malformed_json"); }
}

export function createSiteIntelligenceN8nProvider(input: { environment?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; contractDependencies?: ProviderContractDependencies } = {}): SiteResearchProvider {
  const environment = input.environment ?? process.env; const fetchImpl = input.fetchImpl ?? fetch;
  return { providerId: SITE_INTELLIGENCE_PROVIDER_ID, async execute(request) {
    const config = configuration(environment); if (!config) throw new Error("SITE_INTELLIGENCE_PROVIDER_NOT_CONFIGURED");
    const providerRequest = buildSiteIntelligenceProviderRequestV1({ executionId: request.executionId, executionMode: request.executionMode, ...request.authority, focusOpportunityId: request.focusOpportunityId });
    const response = await fetchImpl(config.url, { method: "POST", headers: { "X-Genesis-Site-Research-Authorization": config.secret, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(providerRequest), redirect: "error", cache: "no-store", signal: request.signal });
    if (!response.ok) throw new Error(`SITE_INTELLIGENCE_PROVIDER_HTTP_${response.status}`);
    return parseSiteIntelligenceProviderResponseV1(await boundedJson(response), providerRequest, input.contractDependencies);
  }};
}