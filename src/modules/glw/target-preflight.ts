import type { AuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { getGlwState, type GlwGenerationRequest } from "./page-generation";
import {
  resolveGlwExecutionIdentity,
  type GlwPageExecutionRecord,
} from "./page-execution";

export type GlwTargetPreflightState =
  | "ABSENT"
  | "EXISTS_DRAFT"
  | "EXISTS_OTHER"
  | "EXISTS_PUBLISHED"
  | "BLOCKED"
  | "UNKNOWN";

export type GlwTargetPreflightClassification =
  | "NEW"
  | "EXISTS_DRAFT"
  | "EXISTS_PUBLISHED"
  | "EXISTS_OTHER"
  | "BLOCKED";

export function classifyGlwTargetPreflight(
  preflight: Pick<GlwTargetPreflightResult, "state">,
): GlwTargetPreflightClassification {
  if (preflight.state === "ABSENT") return "NEW";
  if (preflight.state === "EXISTS_DRAFT") return "EXISTS_DRAFT";
  if (preflight.state === "EXISTS_PUBLISHED") return "EXISTS_PUBLISHED";
  if (preflight.state === "EXISTS_OTHER") return "EXISTS_OTHER";
  return "BLOCKED";
}

export type GlwHierarchyNodeState =
  | "ABSENT"
  | "EXISTS_DRAFT"
  | "EXISTS_PUBLISHED"
  | "PARENT_ABSENT"
  | "AMBIGUOUS"
  | "UNSUPPORTED_STATUS"
  | "UNVERIFIED";

export type GlwHierarchyNodePreflight = {
  slug: string;
  parentId: string | null;
  state: GlwHierarchyNodeState;
  wordpressObjectId: string | null;
  wordpressStatus: string | null;
};

export type GlwHierarchyPreflight = {
  productParent: GlwHierarchyNodePreflight;
  stateParent: GlwHierarchyNodePreflight;
  leaf: GlwHierarchyNodePreflight;
  generationAvailable: boolean;
};

export type GlwCanonicalTargetIdentity = {
  applicationPath: string;
  canonicalPath: string;
  canonicalProduct: string;
  canonicalProductSlug: string;
  canonicalSlug: string;
  canonicalParentId: string | null;
};

export type GlwTargetPreflightResult = GlwCanonicalTargetIdentity & {
  state: GlwTargetPreflightState;
  wordpressObjectId: string | null;
  wordpressStatus: string | null;
  wordpressTitle: string | null;
  wordpressUrl: string | null;
  source: "WORDPRESS_READ" | "LOCAL_EXECUTION" | "UNVERIFIED";
  confidence: "AUTHORITATIVE" | "LOCAL_DURABLE" | "UNVERIFIED";
  hierarchy?: GlwHierarchyPreflight;
};

export type GlwTargetMutationAvailability = {
  createAvailable: boolean;
  updateAvailable: boolean;
  plannedOperation: GlwGenerationRequest["plannedOperation"] | null;
  wordpressObjectId: string | null;
  message: string;
};

export type GlwWordPressTargetPage = {
  id?: number;
  slug?: string;
  parent?: number;
  status?: string;
  link?: string;
  title?: { rendered?: string };
  modified_gmt?: string;
  featured_media?: number;
  author?: number;
};

type FetchResponse = {
  ok: boolean;
  json(): Promise<unknown>;
};

export function createGlwCanonicalTargetIdentity(input: {
  organizationId: string;
  siteId: string;
  productId: string;
  stateCode: string;
  citySlug: string;
  applicationPath: string;
  canonicalParentId?: string | null;
}): GlwCanonicalTargetIdentity {
  const state = getGlwState(input.stateCode);
  const executionIdentity = resolveGlwExecutionIdentity({
    applicationOrganizationId: input.organizationId,
    applicationSiteId: input.siteId,
    applicationProductId: input.productId,
  });
  const canonicalProductSlug = executionIdentity.engineProductSlug;
  const canonicalSlug = input.citySlug.trim().toLowerCase();
  return {
    applicationPath: input.applicationPath,
    canonicalPath: [canonicalProductSlug, state?.slug, canonicalSlug].filter(Boolean).join("/"),
    canonicalProduct: executionIdentity.engineProductName,
    canonicalProductSlug,
    canonicalSlug,
    canonicalParentId: input.canonicalParentId ?? null,
  };
}

export function resolveGlwTargetMutationAvailability(
  preflight: GlwTargetPreflightResult,
): GlwTargetMutationAvailability {
  if (preflight.state === "EXISTS_DRAFT") {
    return {
      createAvailable: false,
      updateAvailable: Boolean(preflight.wordpressObjectId),
      plannedOperation: "UPDATE_CITY",
      wordpressObjectId: preflight.wordpressObjectId,
      message: "An existing draft is available for exact-ID update.",
    };
  }
  if (preflight.state === "EXISTS_PUBLISHED") {
    return {
      createAvailable: false,
      updateAvailable: false,
      plannedOperation: null,
      wordpressObjectId: preflight.wordpressObjectId,
      message: "This canonical target is published. Mutation is unavailable under the draft-only release.",
    };
  }
  if (preflight.state === "ABSENT") {
    return {
      createAvailable: true,
      updateAvailable: false,
      plannedOperation: "CREATE_CITY",
      wordpressObjectId: null,
      message: "No canonical WordPress target exists. Draft creation is available.",
    };
  }
  return {
    createAvailable: false,
    updateAvailable: false,
    plannedOperation: null,
    wordpressObjectId: null,
    message: "Target existence is unknown. Authoritative verification is required before creation.",
  };
}

export function resolveGlwTargetPreflight(input: {
  identity: GlwCanonicalTargetIdentity;
  wordpressPages?: readonly GlwWordPressTargetPage[] | null;
  localExecutions?: readonly GlwPageExecutionRecord[];
  inventoryComplete?: boolean;
  siteId: string;
  productId: string;
  stateName: string;
  cityName: string;
  hierarchy?: GlwHierarchyPreflight;
}): GlwTargetPreflightResult {
  const page = input.wordpressPages?.find((candidate) =>
    String(candidate.slug ?? "") === input.identity.canonicalSlug
    && String(candidate.parent ?? "") === String(input.identity.canonicalParentId ?? ""));
  if (page?.id) {
    const published = page.status === "publish";
    return {
      ...input.identity,
      state: published ? "EXISTS_PUBLISHED" : "EXISTS_DRAFT",
      wordpressObjectId: String(page.id),
      wordpressStatus: page.status ?? null,
      wordpressTitle: page.title?.rendered ?? null,
      wordpressUrl: page.link ?? null,
      source: "WORDPRESS_READ",
      confidence: "AUTHORITATIVE",
      hierarchy: input.hierarchy,
    };
  }

  const local = input.localExecutions?.find((record) =>
    record.status === "COMPLETE"
    && record.siteId === input.siteId
    && record.productId === input.productId
    && record.state === input.stateName
    && record.city === input.cityName
    && record.slug === input.identity.applicationPath
    && Boolean(record.wordpressObjectId));
  if (local) {
    return {
      ...input.identity,
      state: local.wordpressStatus === "draft" ? "EXISTS_DRAFT" : "EXISTS_PUBLISHED",
      wordpressObjectId: local.wordpressObjectId,
      wordpressStatus: local.wordpressStatus,
      wordpressTitle: local.title,
      wordpressUrl: local.wordpressUrl,
      source: "LOCAL_EXECUTION",
      confidence: "LOCAL_DURABLE",
      hierarchy: input.hierarchy,
    };
  }

  return {
    ...input.identity,
    state: input.inventoryComplete ? "ABSENT" : "UNKNOWN",
    wordpressObjectId: null,
    wordpressStatus: null,
    wordpressTitle: null,
    wordpressUrl: null,
    source: input.inventoryComplete ? "WORDPRESS_READ" : "UNVERIFIED",
    confidence: input.inventoryComplete ? "AUTHORITATIVE" : "UNVERIFIED",
    hierarchy: input.hierarchy,
  };
}

function unresolvedNode(slug: string, parentId: string | null): GlwHierarchyNodePreflight {
  return { slug, parentId, state: "UNVERIFIED", wordpressObjectId: null, wordpressStatus: null };
}

function parentAbsentNode(slug: string): GlwHierarchyNodePreflight {
  return { slug, parentId: null, state: "PARENT_ABSENT", wordpressObjectId: null, wordpressStatus: null };
}

function classifyNode(input: {
  slug: string;
  parentId: string;
  pages: readonly GlwWordPressTargetPage[] | null;
  authoritative: boolean;
}): GlwHierarchyNodePreflight {
  if (!input.pages) return unresolvedNode(input.slug, input.parentId);
  const exact = input.pages.filter((page) =>
    page.slug?.trim().toLowerCase() === input.slug
    && String(page.parent ?? "") === input.parentId);
  if (exact.length === 0) {
    if (!input.authoritative) return unresolvedNode(input.slug, input.parentId);
    return { slug: input.slug, parentId: input.parentId, state: "ABSENT", wordpressObjectId: null, wordpressStatus: null };
  }
  if (exact.length !== 1 || !exact[0]?.id) {
    return { slug: input.slug, parentId: input.parentId, state: "AMBIGUOUS", wordpressObjectId: null, wordpressStatus: null };
  }
  const page = exact[0];
  const status = page.status ?? null;
  if (status !== "draft" && status !== "publish") {
    return { slug: input.slug, parentId: input.parentId, state: "UNSUPPORTED_STATUS", wordpressObjectId: String(page.id), wordpressStatus: status };
  }
  return {
    slug: input.slug,
    parentId: input.parentId,
    state: status === "publish" ? "EXISTS_PUBLISHED" : "EXISTS_DRAFT",
    wordpressObjectId: String(page.id),
    wordpressStatus: status,
  };
}

function blockedPreflight(input: {
  identity: GlwCanonicalTargetIdentity;
  hierarchy: GlwHierarchyPreflight;
}): GlwTargetPreflightResult {
  return {
    ...input.identity,
    state: "BLOCKED",
    wordpressObjectId: null,
    wordpressStatus: null,
    wordpressTitle: null,
    wordpressUrl: null,
    source: "WORDPRESS_READ",
    confidence: "AUTHORITATIVE",
    hierarchy: input.hierarchy,
  };
}

function otherPreflight(input: {
  identity: GlwCanonicalTargetIdentity;
  hierarchy: GlwHierarchyPreflight;
  page: GlwWordPressTargetPage;
}): GlwTargetPreflightResult {
  return {
    ...input.identity,
    state: "EXISTS_OTHER",
    wordpressObjectId: input.page.id ? String(input.page.id) : null,
    wordpressStatus: input.page.status ?? null,
    wordpressTitle: input.page.title?.rendered ?? null,
    wordpressUrl: input.page.link ?? null,
    source: "WORDPRESS_READ",
    confidence: "AUTHORITATIVE",
    hierarchy: input.hierarchy,
  };
}

export async function readGlwTargetPreflight(input: {
  request: GlwGenerationRequest;
  wordpressApiBaseUrl?: string | null;
  wordpressReadAuthority?: AuthenticatedWordPressReadAuthority | null;
  localExecutions: readonly GlwPageExecutionRecord[];
  fetcher?: (url: string, init: { headers: Record<string, string> }) => Promise<FetchResponse>;
}): Promise<GlwTargetPreflightResult> {
  const state = getGlwState(input.request.stateCode);
  const initialIdentity = createGlwCanonicalTargetIdentity({
    organizationId: input.request.organizationId,
    siteId: input.request.siteId,
    productId: input.request.productId,
    stateCode: input.request.stateCode,
    citySlug: input.request.citySlug,
    applicationPath: input.request.canonicalPath,
  });
  const common = {
    siteId: input.request.siteId,
    productId: input.request.productId,
    stateName: input.request.stateName ?? "",
    cityName: input.request.cityName ?? "",
    localExecutions: input.localExecutions,
  };
  if ((!input.wordpressApiBaseUrl && !input.wordpressReadAuthority) || !state || input.request.pageType !== "city_service") {
    return resolveGlwTargetPreflight({ identity: initialIdentity, ...common });
  }

  const fetcher = input.fetcher ?? fetch;
  const readPages = async (slug: string, parent: string): Promise<{
    pages: readonly GlwWordPressTargetPage[] | null;
    authoritative: boolean;
  }> => {
    const query = new URLSearchParams({
      slug,
      parent,
      context: input.wordpressReadAuthority ? "edit" : "view",
      per_page: "100",
      _fields: "id,slug,parent,status,link,title",
    });
    if (input.wordpressReadAuthority) {
      query.set("status", "any");
      const response = await input.wordpressReadAuthority.getJson({ path: "/pages", query });
      return response.ok && Array.isArray(response.body)
        ? { pages: response.body as GlwWordPressTargetPage[], authoritative: true }
        : { pages: null, authoritative: false };
    }
    try {
      const response = await fetcher(`${input.wordpressApiBaseUrl}/pages?${query}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return { pages: null, authoritative: false };
      const body = await response.json();
      return { pages: Array.isArray(body) ? body as GlwWordPressTargetPage[] : null, authoritative: false };
    } catch {
      return { pages: null, authoritative: false };
    }
  };

  const productRead = await readPages(initialIdentity.canonicalProductSlug, "0");
  const productParent = classifyNode({
    slug: initialIdentity.canonicalProductSlug,
    parentId: "0",
    ...productRead,
  });
  if (["UNVERIFIED", "AMBIGUOUS", "UNSUPPORTED_STATUS"].includes(productParent.state)) {
    const hierarchy = {
      productParent,
      stateParent: unresolvedNode(state.slug, null),
      leaf: unresolvedNode(initialIdentity.canonicalSlug, null),
      generationAvailable: false,
    } satisfies GlwHierarchyPreflight;
    return productParent.state === "UNVERIFIED"
      ? resolveGlwTargetPreflight({ identity: initialIdentity, hierarchy, ...common })
      : blockedPreflight({ identity: initialIdentity, hierarchy });
  }
  if (productParent.state === "ABSENT") {
    const hierarchy = {
      productParent,
      stateParent: parentAbsentNode(state.slug),
      leaf: parentAbsentNode(initialIdentity.canonicalSlug),
      generationAvailable: true,
    } satisfies GlwHierarchyPreflight;
    return resolveGlwTargetPreflight({ identity: initialIdentity, wordpressPages: [], inventoryComplete: true, hierarchy, ...common });
  }

  const productParentId = productParent.wordpressObjectId!;
  const stateRead = await readPages(state.slug, productParentId);
  const stateParent = classifyNode({ slug: state.slug, parentId: productParentId, ...stateRead });
  if (["UNVERIFIED", "AMBIGUOUS", "UNSUPPORTED_STATUS"].includes(stateParent.state)) {
    const hierarchy = {
      productParent,
      stateParent,
      leaf: unresolvedNode(initialIdentity.canonicalSlug, null),
      generationAvailable: false,
    } satisfies GlwHierarchyPreflight;
    return stateParent.state === "UNVERIFIED"
      ? resolveGlwTargetPreflight({ identity: initialIdentity, hierarchy, ...common })
      : blockedPreflight({ identity: initialIdentity, hierarchy });
  }
  if (stateParent.state === "ABSENT") {
    const hierarchy = {
      productParent,
      stateParent,
      leaf: parentAbsentNode(initialIdentity.canonicalSlug),
      generationAvailable: true,
    } satisfies GlwHierarchyPreflight;
    return resolveGlwTargetPreflight({ identity: initialIdentity, wordpressPages: [], inventoryComplete: true, hierarchy, ...common });
  }

  const stateParentId = stateParent.wordpressObjectId!;
  const identity = createGlwCanonicalTargetIdentity({
    organizationId: input.request.organizationId,
    siteId: input.request.siteId,
    productId: input.request.productId,
    stateCode: input.request.stateCode,
    citySlug: input.request.citySlug,
    applicationPath: input.request.canonicalPath,
    canonicalParentId: String(stateParentId),
  });
  const targetRead = await readPages(identity.canonicalSlug, stateParentId);
  const leaf = classifyNode({ slug: identity.canonicalSlug, parentId: stateParentId, ...targetRead });
  const hierarchy = {
    productParent,
    stateParent,
    leaf,
    generationAvailable: !["UNVERIFIED", "AMBIGUOUS", "UNSUPPORTED_STATUS"].includes(leaf.state),
  } satisfies GlwHierarchyPreflight;
  if (leaf.state === "UNVERIFIED") {
    return resolveGlwTargetPreflight({ identity, hierarchy, ...common });
  }
  if (leaf.state === "AMBIGUOUS" || leaf.state === "UNSUPPORTED_STATUS") {
    return blockedPreflight({ identity, hierarchy });
  }
  const local = input.localExecutions.find((record) =>
    record.status === "COMPLETE"
    && record.siteId === input.request.siteId
    && record.productId === input.request.productId
    && record.state === (input.request.stateName ?? "")
    && record.city === (input.request.cityName ?? "")
    && record.slug === identity.applicationPath
    && Boolean(record.wordpressObjectId));
  if (leaf.state === "ABSENT" && local?.wordpressObjectId && input.wordpressReadAuthority) {
    const exactIdRead = await input.wordpressReadAuthority.getJson({
      path: `/pages/${local.wordpressObjectId}`,
      query: new URLSearchParams({
        context: "edit",
        _fields: "id,slug,parent,status,link,title",
      }),
    });
    if (!exactIdRead.ok) {
      if (exactIdRead.reason !== "NOT_FOUND") {
        return blockedPreflight({ identity, hierarchy: { ...hierarchy, generationAvailable: false } });
      }
      return resolveGlwTargetPreflight({
        identity,
        wordpressPages: [],
        inventoryComplete: true,
        hierarchy,
        ...common,
        localExecutions: [],
      });
    } else if (!exactIdRead.body || typeof exactIdRead.body !== "object" || Array.isArray(exactIdRead.body)) {
      return blockedPreflight({ identity, hierarchy: { ...hierarchy, generationAvailable: false } });
    } else {
      const page = exactIdRead.body as GlwWordPressTargetPage;
      if (
        String(page.id ?? "") !== local.wordpressObjectId
        || page.slug !== identity.canonicalSlug
        || String(page.parent ?? "") !== stateParentId
      ) {
        return otherPreflight({
          identity,
          hierarchy: { ...hierarchy, generationAvailable: false },
          page,
        });
      }
      return resolveGlwTargetPreflight({
        identity,
        wordpressPages: [page],
        inventoryComplete: true,
        hierarchy,
        ...common,
      });
    }
  }
  return resolveGlwTargetPreflight({
    identity,
    wordpressPages: targetRead.pages,
    inventoryComplete: targetRead.authoritative,
    hierarchy,
    ...common,
  });
}