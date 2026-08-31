import type { AuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { getGlwState, type GlwGenerationRequest } from "./page-generation";
import type { GlwPageExecutionRecord } from "./page-execution";

export type GlwTargetPreflightState =
  | "ABSENT"
  | "EXISTS_DRAFT"
  | "EXISTS_PUBLISHED"
  | "UNKNOWN";

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

export function createGlwCanonicalTargetIdentity(input: {
  productId: string;
  productTopic: string;
  stateCode: string;
  citySlug: string;
  applicationPath: string;
  canonicalParentId?: string | null;
}): GlwCanonicalTargetIdentity {
  const state = getGlwState(input.stateCode);
  const applicationPathSegments = input.applicationPath
    .split("/")
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);

  const canonicalProductSlug = applicationPathSegments[0] ?? "";

  if (!canonicalProductSlug) {
    throw new Error("Canonical product slug is required.");
  }
  const canonicalSlug = input.citySlug.trim().toLowerCase();
  return {
    applicationPath: input.applicationPath,
    canonicalPath: [canonicalProductSlug, state?.slug, canonicalSlug].filter(Boolean).join("/"),
    canonicalProduct: input.productTopic.trim(),
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
    createAvailable: true,
    updateAvailable: false,
    plannedOperation: "CREATE_CITY",
    wordpressObjectId: null,
    message: "Target existence is unknown and will be verified authoritatively before creation.",
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
  };
}

export async function readGlwTargetPreflight(input: {
  request: GlwGenerationRequest;
  wordpressReadAuthority: AuthenticatedWordPressReadAuthority | null;
  localExecutions: readonly GlwPageExecutionRecord[];
}): Promise<GlwTargetPreflightResult> {
  const state = getGlwState(input.request.stateCode);
  const initialIdentity = createGlwCanonicalTargetIdentity({
    productId: input.request.productId,
    productTopic: input.request.productTopic,
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
  if (!input.wordpressReadAuthority || !state || input.request.pageType !== "city_service") {
    return resolveGlwTargetPreflight({ identity: initialIdentity, ...common });
  }

  const readPages = async (
    slug: string,
    parent: string,
  ): Promise<{
    pages: readonly GlwWordPressTargetPage[] | null;
    authoritative: boolean;
  }> => {
    const query = new URLSearchParams({
      slug,
      parent,
      context: "edit",
      status: "publish,draft,pending,private,future",
      per_page: "2",
      _fields: "id,slug,parent,status,link,title",
    });

    const response = await input.wordpressReadAuthority.getJson({
      path: "/pages",
      query,
    });

    if (!response.ok || !Array.isArray(response.body)) {
      return {
        pages: null,
        authoritative: false,
      };
    }

    return {
      pages: response.body as GlwWordPressTargetPage[],
      authoritative: true,
    };
  };

  const productRead = await readPages(
    initialIdentity.canonicalProductSlug,
    "0",
  );

  if (!productRead.authoritative) {
    return resolveGlwTargetPreflight({
      identity: initialIdentity,
      ...common,
    });
  }

  const productParentId = productRead.pages?.[0]?.id;

  if (!productParentId) {
    return resolveGlwTargetPreflight({
      identity: initialIdentity,
      wordpressPages: [],
      inventoryComplete: true,
      ...common,
    });
  }

  const stateRead = await readPages(
    state.slug,
    String(productParentId),
  );

  if (!stateRead.authoritative) {
    return resolveGlwTargetPreflight({
      identity: initialIdentity,
      ...common,
    });
  }

  const stateParentId = stateRead.pages?.[0]?.id;

  if (!stateParentId) {
    return resolveGlwTargetPreflight({
      identity: initialIdentity,
      wordpressPages: [],
      inventoryComplete: true,
      ...common,
    });
  }

  const identity = createGlwCanonicalTargetIdentity({
    productId: input.request.productId,
    productTopic: input.request.productTopic,
    stateCode: input.request.stateCode,
    citySlug: input.request.citySlug,
    applicationPath: input.request.canonicalPath,
    canonicalParentId: String(stateParentId),
  });

  const targetRead = await readPages(
    identity.canonicalSlug,
    String(stateParentId),
  );

  if (!targetRead.authoritative) {
    return resolveGlwTargetPreflight({
      identity,
      ...common,
    });
  }

  return resolveGlwTargetPreflight({
    identity,
    wordpressPages: targetRead.pages,
    inventoryComplete: true,
    ...common,
  });
}
