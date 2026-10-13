import {
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";

const PERSISTENCE_NAMESPACE = "glw-research-source-registry";

export type GlwResearchSourceRole =
  | "FIRST_PARTY_PRODUCT_AUTHORITY"
  | "FIRST_PARTY_SITE_AUTHORITY"
  | "MANUFACTURER_AUTHORITY"
  | "OFFICIAL_SOFTWARE_AUTHORITY"
  | "INDUSTRY_REFERENCE"
  | "COMPETITOR_RESEARCH"
  | "MARKET_DISCOVERY"
  | "SEARCH_DISCOVERY";

export type GlwResearchSourceRecord = {
  sourceId: string;
  url: string;
  domain: string;
  title: string;
  topic: string;
  roles: readonly GlwResearchSourceRole[];
  classification: "AUTHORITY" | "DISCOVERY_ONLY";
  mayCreateProductFacts: boolean;
  accessStatus: "ACCESSIBLE" | "ACCESS_UNAVAILABLE";
  retrievedAt: string;
  discovery: {
    headings: readonly string[];
    terminology: readonly string[];
    buyerQuestions: readonly string[];
    applications: readonly string[];
    selectionCriteria: readonly string[];
    environmentalTopics: readonly string[];
    installationTopics: readonly string[];
    nicheAudiences: readonly string[];
    relatedTopicUrls: readonly string[];
    contentOpportunities: readonly string[];
    technicalClaimsRequiringCorroboration: readonly string[];
    competitorOnlyClaims: readonly string[];
  };
};

type RegistryState = { sources: GlwResearchSourceRecord[] };

function load() {
  return loadPersistedState<RegistryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: () => ({ sources: [] }),
  });
}

function discoveryOnlyRole(role: GlwResearchSourceRole): boolean {
  return role === "COMPETITOR_RESEARCH"
    || role === "MARKET_DISCOVERY"
    || role === "SEARCH_DISCOVERY";
}

function validate(record: GlwResearchSourceRecord): void {
  const url = new URL(record.url);
  if (url.protocol !== "https:" || url.hostname !== record.domain) {
    throw new Error("Research source requires an exact canonical HTTPS domain.");
  }
  if (!record.sourceId.trim() || !record.title.trim() || record.roles.length === 0) {
    throw new Error("Research source identity, title, and roles are required.");
  }
  if (
    record.classification === "DISCOVERY_ONLY"
    && (
      record.mayCreateProductFacts
      || record.roles.some((role) => !discoveryOnlyRole(role))
    )
  ) {
    throw new Error("Discovery-only sources cannot create product facts or hold authority roles.");
  }
}

export function registerGlwResearchSource(
  input: GlwResearchSourceRecord,
): { source: GlwResearchSourceRecord; created: boolean } {
  validate(input);
  const loaded = load();
  const existing = loaded.state.sources.find(
    (source) => source.sourceId === input.sourceId,
  );
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(input)) {
      throw new Error("Research source identity already exists with different authority metadata.");
    }
    return { source: deepClone(existing), created: false };
  }
  const state = {
    sources: [...loaded.state.sources, deepClone(input)],
  };
  savePersistedState({
    namespace: PERSISTENCE_NAMESPACE,
    state,
    expectedRevision: loaded.revision,
  });
  return { source: deepClone(input), created: true };
}

export function listGlwResearchSources(): readonly GlwResearchSourceRecord[] {
  return load().state.sources.map((source) => deepClone(source));
}