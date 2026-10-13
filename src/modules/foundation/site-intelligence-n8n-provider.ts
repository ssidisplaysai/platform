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

function configuration(environment: NodeJS.ProcessEnv = process.env) {
  const value = environment.GENESIS_SITE_INTELLIGENCE_WEBHOOK_URL?.trim() ?? "";
  const secret = environment.GENESIS_SITE_INTELLIGENCE_WEBHOOK_SECRET?.trim() ?? "";
  if (!value || !secret) return null;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== HOST || url.pathname !== PATH || url.username || url.password || url.search || url.hash) throw new Error("SITE_INTELLIGENCE_PROVIDER_ENDPOINT_INVALID");
  return { url: url.toString(), secret };
}

export function getSiteIntelligenceProviderStatus(environment: NodeJS.ProcessEnv = process.env) {
  return { configured: Boolean(configuration(environment)), providerId: SITE_INTELLIGENCE_PROVIDER_ID, endpointAuthority: `${HOST}${PATH}` };
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