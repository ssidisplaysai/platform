import "server-only";

import type { SiteResearchProvider } from "./site-intelligence-research-executor";

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
  return { configured: Boolean(configuration(environment)), providerId: "n8n-site-intelligence-v1", endpointAuthority: `${HOST}${PATH}` };
}

export function createSiteIntelligenceN8nProvider(input: { environment?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch } = {}): SiteResearchProvider {
  const environment = input.environment ?? process.env; const fetchImpl = input.fetchImpl ?? fetch;
  return { providerId: "n8n-site-intelligence-v1", async execute(request) {
    const config = configuration(environment); if (!config) throw new Error("SITE_INTELLIGENCE_PROVIDER_NOT_CONFIGURED");
    const response = await fetchImpl(config.url, { method: "POST", headers: { "X-Genesis-Site-Research-Authorization": config.secret, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ workflowId: "genesis-site-intelligence-v1", identity: { executionId: request.executionId, organizationId: request.authority.organizationId, siteId: request.authority.siteId }, authority: request.authority, focusOpportunityId: request.focusOpportunityId, objectives: ["market_competitors", "verticals_niches", "search_terminology", "competitor_structure"] }), redirect: "error", cache: "no-store", signal: request.signal });
    const body = await response.json().catch(() => null); if (!response.ok || !body) throw new Error(`SITE_INTELLIGENCE_PROVIDER_HTTP_${response.status}`);
    return body as never;
  }};
}