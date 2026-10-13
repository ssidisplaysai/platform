import "server-only";

import { deepClone, loadPersistedState, savePersistedState } from "./foundation-persistence";
import { createCrossSellGraph, validateMarketIntelligence, type CampaignDiscoveryRecommendation, type CatalogAuthorityItem, type MarketApplicationMapping, type MarketCrossSellGraph, type PageStrategyRecommendation, type SiteMarketIntelligence, type SiteMarketProductOpportunity, type SiteOpportunityBlueprint } from "./local-market-product-match";

const NAMESPACE = "site-market-product-match-v1";
export type MarketProductMatchBundle = { bundleId: string; intelligence: SiteMarketIntelligence; catalog: readonly CatalogAuthorityItem[]; applicationMappings: readonly MarketApplicationMapping[]; opportunities: readonly SiteMarketProductOpportunity[]; crossSellGraph: MarketCrossSellGraph; campaignDiscovery: readonly CampaignDiscoveryRecommendation[]; pageStrategy: PageStrategyRecommendation; siteBlueprint: SiteOpportunityBlueprint; proofBlueprints: readonly SiteOpportunityBlueprint[]; createdAt: string };
type State = { bundles: MarketProductMatchBundle[] };
const load = () => loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: () => ({ bundles: [] }) });

export function saveMarketProductMatchBundle(bundle: MarketProductMatchBundle): MarketProductMatchBundle {
  validateMarketIntelligence(bundle.intelligence, bundle.createdAt); createCrossSellGraph(bundle.crossSellGraph, bundle.catalog);
  if (bundle.pageStrategy.mutationAuthorized !== false || bundle.pageStrategy.compositionAuthorityPreserved !== true || bundle.campaignDiscovery.some((item) => item.campaignMutationAuthorized !== false || item.ownerApprovalRequired !== true) || bundle.siteBlueprint.mutationAuthorized !== false || bundle.proofBlueprints.some((item) => item.mutationAuthorized !== false)) throw new Error("MARKET_MATCH_MUTATION_AUTHORITY_FORBIDDEN");
  if (bundle.opportunities.some((item) => item.market.marketId !== bundle.intelligence.market.marketId || item.organizationId !== bundle.intelligence.organizationId)) throw new Error("MARKET_MATCH_IDENTITY_MISMATCH");
  const loaded = load(); const existing = loaded.state.bundles.find((item) => item.bundleId === bundle.bundleId); if (existing) { if (JSON.stringify(existing) !== JSON.stringify(bundle)) throw new Error("MARKET_MATCH_BUNDLE_COLLISION"); return deepClone(existing); }
  loaded.state.bundles.push(deepClone(bundle)); savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision }); return deepClone(bundle);
}

export function getMarketProductMatchBundle(input: { organizationId: string; marketId?: string; bundleId?: string }): MarketProductMatchBundle | null { const items = load().state.bundles.filter((item) => item.intelligence.organizationId === input.organizationId && (!input.marketId || item.intelligence.market.marketId === input.marketId) && (!input.bundleId || item.bundleId === input.bundleId)); if (!items.length) return null; const bundle = deepClone(items.at(-1)!); validateMarketIntelligence(bundle.intelligence); return bundle; }

export function listMarketProductMatchBundles(organizationId: string): MarketProductMatchBundle[] { return deepClone(load().state.bundles.filter((item) => item.intelligence.organizationId === organizationId).map((bundle) => { validateMarketIntelligence(bundle.intelligence); return bundle; })); }