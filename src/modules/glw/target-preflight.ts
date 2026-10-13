import type { AuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { getGlwState, type GlwGenerationRequest } from "./page-generation";
import type { GlwPageExecutionRecord } from "./page-execution";

export type GlwTargetPreflightState =
  | "ABSENT"
  | "EXISTS_DRAFT"
  | "EXISTS_PUBLISHED"
  | "UNKNOWN";

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
  pageType: GlwGenerationRequest["pageType"] = "city_service",
): GlwTargetMutationAvailability {
  const createOperation = pageType === "general_service"
    ? "CREATE_GENERAL"
    : pageType === "state_service"
      ? "CREATE_STATE"
      : "CREATE_CITY";
  const updateOperation = pageType === "general_service"
    ? "UPDATE_GENERAL"
    : pageType === "state_service"
      ? "UPDATE_STATE"
      : "UPDATE_CITY";
  if (preflight.state === "EXISTS_DRAFT") {
    return {
      createAvailable: false,
      updateAvailable: Boolean(preflight.wordpressObjectId),
      plannedOperation: updateOperation,
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
      createAvailable: preflight.hierarchy?.generationAvailable ?? true,
      updateAvailable: false,
      plannedOperation: preflight.hierarchy?.generationAvailable === false ? null : createOperation,
      wordpressObjectId: null,
      message: preflight.hierarchy?.generationAvailable === false
        ? "The canonical target is absent, but its WordPress hierarchy is not safe for automatic generation."
        : "No canonical WordPress target exists. Draft creation is available.",
    };
  }
  return {
    createAvailable: false,
    updateAvailable: false,
    plannedOperation: null,
    wordpressObjectId: null,
    message: "Target or hierarchy identity is not authoritatively resolved. Mutation is unavailable until preflight succeeds.",
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
  return {
    slug,
    parentId,
    state: "UNVERIFIED",
    wordpressObjectId: null,
    wordpressStatus: null,
  };
}

function parentAbsentNode(slug: string): GlwHierarchyNodePreflight {
  return {
    slug,
    parentId: null,
    state: "PARENT_ABSENT",
    wordpressObjectId: null,
    wordpressStatus: null,
  };
}

function classifyNode(input: {
  slug: string;
  parentId: string;
  pages: readonly GlwWordPressTargetPage[] | null;
  authoritative: boolean;
}): GlwHierarchyNodePreflight {
  if (!input.authoritative || !input.pages) {
    return unresolvedNode(input.slug, input.parentId);
  }

  const exact = input.pages.filter((candidate) =>
    String(candidate.slug ?? "").trim().toLowerCase() === input.slug
    && String(candidate.parent ?? "") === input.parentId,
  );

  if (exact.length === 0) {
    return {
      slug: input.slug,
      parentId: input.parentId,
      state: "ABSENT",
      wordpressObjectId: null,
      wordpressStatus: null,
    };
  }

  if (exact.length !== 1 || !exact[0]?.id) {
    return {
      slug: input.slug,
      parentId: input.parentId,
      state: "AMBIGUOUS",
      wordpressObjectId: null,
      wordpressStatus: null,
    };
  }

  const page = exact[0];
  const status = page.status ?? null;
  if (status !== "draft" && status !== "publish") {
    return {
      slug: input.slug,
      parentId: input.parentId,
      state: "UNSUPPORTED_STATUS",
      wordpressObjectId: String(page.id),
      wordpressStatus: status,
    };
  }

  return {
    slug: input.slug,
    parentId: input.parentId,
    state: status === "publish" ? "EXISTS_PUBLISHED" : "EXISTS_DRAFT",
    wordpressObjectId: String(page.id),
    wordpressStatus: status,
  };
}

function hierarchyIsSafeForGeneration(hierarchy: GlwHierarchyPreflight): boolean {
  const unsafeStates: readonly GlwHierarchyNodeState[] = [
    "AMBIGUOUS",
    "UNSUPPORTED_STATUS",
    "UNVERIFIED",
  ];
  return ![
    hierarchy.productParent.state,
    hierarchy.stateParent.state,
    hierarchy.leaf.state,
  ].some((state) => unsafeStates.includes(state));
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
  if (input.request.pageType === "general_service" && input.wordpressReadAuthority) {
    const identity = {
      ...createGlwCanonicalTargetIdentity({
        productId: input.request.productId,
        productTopic: input.request.productTopic,
        stateCode: "",
        citySlug: input.request.canonicalPath,
        applicationPath: input.request.canonicalPath,
        canonicalParentId: "0",
      }),
      canonicalPath: input.request.canonicalPath,
    };
    const response = await input.wordpressReadAuthority.getJson({
      path: "/pages",
      query: new URLSearchParams({
        slug: identity.canonicalSlug,
        parent: "0",
        context: "edit",
        status: "publish,draft,pending,private,future",
        per_page: "100",
        _fields: "id,slug,parent,status,link,title",
      }),
    });
    if (!response.ok || !Array.isArray(response.body)) {
      return resolveGlwTargetPreflight({ identity, ...common });
    }
    const exact = (response.body as GlwWordPressTargetPage[]).filter(
      (page) => page.slug === identity.canonicalSlug && page.parent === 0,
    );
    if (exact.length > 1) {
      return resolveGlwTargetPreflight({ identity, ...common });
    }
    return resolveGlwTargetPreflight({
      identity,
      wordpressPages: exact,
      inventoryComplete: true,
      ...common,
    });
  }
  if (!input.wordpressReadAuthority || !state || (input.request.pageType !== "city_service" && input.request.pageType !== "state_service")) {
    return resolveGlwTargetPreflight({ identity: initialIdentity, ...common });
  }

  const wordpressReadAuthority = input.wordpressReadAuthority;

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
      per_page: "100",
      _fields: "id,slug,parent,status,link,title",
    });

    const response = await wordpressReadAuthority.getJson({
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

  const productRead = await readPages(initialIdentity.canonicalProductSlug, "0");
  const productParent = classifyNode({
    slug: initialIdentity.canonicalProductSlug,
    parentId: "0",
    ...productRead,
  });

  if (productParent.state === "UNVERIFIED" || productParent.state === "AMBIGUOUS" || productParent.state === "UNSUPPORTED_STATUS") {
    const hierarchy: GlwHierarchyPreflight = {
      productParent,
      stateParent: unresolvedNode(state.slug, null),
      leaf: unresolvedNode(initialIdentity.canonicalSlug, null),
      generationAvailable: false,
    };
    return resolveGlwTargetPreflight({ identity: initialIdentity, hierarchy, ...common });
  }

  if (productParent.state === "ABSENT") {
    const hierarchy: GlwHierarchyPreflight = {
      productParent,
      stateParent: parentAbsentNode(state.slug),
      leaf: parentAbsentNode(initialIdentity.canonicalSlug),
      generationAvailable: true,
    };
    return resolveGlwTargetPreflight({
      identity: initialIdentity,
      wordpressPages: [],
      inventoryComplete: true,
      hierarchy,
      ...common,
    });
  }

  const productParentId = productParent.wordpressObjectId!;
  const stateRead = await readPages(state.slug, productParentId);
  const stateParent = classifyNode({
    slug: state.slug,
    parentId: productParentId,
    ...stateRead,
  });

  if (input.request.pageType === "state_service") {
    const identity = {
      ...createGlwCanonicalTargetIdentity({
        productId: input.request.productId,
        productTopic: input.request.productTopic,
        stateCode: input.request.stateCode,
        citySlug: state.slug,
        applicationPath: input.request.canonicalPath,
        canonicalParentId: productParentId,
      }),
      canonicalPath: input.request.canonicalPath,
    };

    const hierarchyBase: GlwHierarchyPreflight = {
      productParent,
      stateParent,
      leaf: stateParent,
      generationAvailable: true,
    };

    const hierarchy = {
      ...hierarchyBase,
      generationAvailable: hierarchyIsSafeForGeneration(hierarchyBase),
    };

    if (
      stateParent.state === "UNVERIFIED"
      || stateParent.state === "AMBIGUOUS"
      || stateParent.state === "UNSUPPORTED_STATUS"
    ) {
      return resolveGlwTargetPreflight({
        identity,
        hierarchy,
        ...common,
      });
    }

    return resolveGlwTargetPreflight({
      identity,
      wordpressPages: stateRead.pages,
      inventoryComplete: true,
      hierarchy,
      ...common,
    });
  }
  if (stateParent.state === "UNVERIFIED" || stateParent.state === "AMBIGUOUS" || stateParent.state === "UNSUPPORTED_STATUS") {
    const hierarchy: GlwHierarchyPreflight = {
      productParent,
      stateParent,
      leaf: unresolvedNode(initialIdentity.canonicalSlug, null),
      generationAvailable: false,
    };
    return resolveGlwTargetPreflight({ identity: initialIdentity, hierarchy, ...common });
  }

  if (stateParent.state === "ABSENT") {
    const hierarchy: GlwHierarchyPreflight = {
      productParent,
      stateParent,
      leaf: parentAbsentNode(initialIdentity.canonicalSlug),
      generationAvailable: true,
    };
    return resolveGlwTargetPreflight({
      identity: initialIdentity,
      wordpressPages: [],
      inventoryComplete: true,
      hierarchy,
      ...common,
    });
  }

  const stateParentId = stateParent.wordpressObjectId!;
  const identity = createGlwCanonicalTargetIdentity({
    productId: input.request.productId,
    productTopic: input.request.productTopic,
    stateCode: input.request.stateCode,
    citySlug: input.request.citySlug,
    applicationPath: input.request.canonicalPath,
    canonicalParentId: stateParentId,
  });

  const targetRead = await readPages(identity.canonicalSlug, stateParentId);
  const leaf = classifyNode({
    slug: identity.canonicalSlug,
    parentId: stateParentId,
    ...targetRead,
  });
  const hierarchyBase: GlwHierarchyPreflight = {
    productParent,
    stateParent,
    leaf,
    generationAvailable: true,
  };
  const hierarchy = {
    ...hierarchyBase,
    generationAvailable: hierarchyIsSafeForGeneration(hierarchyBase),
  };

  if (leaf.state === "UNVERIFIED" || leaf.state === "AMBIGUOUS" || leaf.state === "UNSUPPORTED_STATUS") {
    return resolveGlwTargetPreflight({ identity, hierarchy, ...common });
  }

  return resolveGlwTargetPreflight({
    identity,
    wordpressPages: targetRead.pages,
    inventoryComplete: true,
    hierarchy,
    ...common,
  });
}
