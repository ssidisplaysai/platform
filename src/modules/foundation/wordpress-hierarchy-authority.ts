import "server-only";

import {
  createAuthenticatedWordPressReadAuthority,
  normalizeWordPressApiBaseUrl,
  type AuthenticatedWordPressReadAuthority,
} from "./authenticated-wordpress-read-authority";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import type { SiteConfiguration } from "./types";

type WordPressHierarchyPage = {
  id?: number;
  slug?: string;
  parent?: number;
  status?: string;
  link?: string;
};

export type GenesisWordPressHierarchyNodeState =
  | "EXISTS_PUBLISHED"
  | "EXISTS_DRAFT"
  | "ABSENT"
  | "COLLISION"
  | "UNVERIFIED";

export type GenesisWordPressHierarchyNode = {
  slug: string;
  parentId: number;
  state: GenesisWordPressHierarchyNodeState;
  wordpressObjectId: number | null;
  wordpressStatus: string | null;
};

export type GenesisWordPressHierarchyResolution =
  | {
      ok: true;
      product: GenesisWordPressHierarchyNode;
      state: GenesisWordPressHierarchyNode;
      leafParentId: number;
    }
  | {
      ok: false;
      state:
        | "not_configured"
        | "credential_unavailable"
        | "invalid_target"
        | "read_failed"
        | "collision"
        | "write_failed";
      message: string;
      product?: GenesisWordPressHierarchyNode;
      stateNode?: GenesisWordPressHierarchyNode;
    };

function normalizeSlug(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
}

function isPage(value: unknown): value is WordPressHierarchyPage {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function readExactNode(input: {
  authority: AuthenticatedWordPressReadAuthority;
  slug: string;
  parentId: number;
}): Promise<GenesisWordPressHierarchyNode> {
  const query = new URLSearchParams({
    slug: input.slug,
    parent: String(input.parentId),
    context: "edit",
    status: "publish,draft,pending,private,future",
    per_page: "100",
    _fields: "id,slug,parent,status,link",
  });
  const response = await input.authority.getJson({ path: "/pages", query });
  if (!response.ok || !Array.isArray(response.body)) {
    return {
      slug: input.slug,
      parentId: input.parentId,
      state: "UNVERIFIED",
      wordpressObjectId: null,
      wordpressStatus: null,
    };
  }
  const exact = response.body.filter((candidate): candidate is WordPressHierarchyPage =>
    isPage(candidate)
    && normalizeSlug(typeof candidate.slug === "string" ? candidate.slug : "") === input.slug
    && candidate.parent === input.parentId,
  );
  if (exact.length > 1) {
    return {
      slug: input.slug,
      parentId: input.parentId,
      state: "COLLISION",
      wordpressObjectId: null,
      wordpressStatus: null,
    };
  }
  const page = exact[0];
  if (!page?.id) {
    return {
      slug: input.slug,
      parentId: input.parentId,
      state: "ABSENT",
      wordpressObjectId: null,
      wordpressStatus: null,
    };
  }
  if (page.status !== "publish" && page.status !== "draft") {
    return {
      slug: input.slug,
      parentId: input.parentId,
      state: "UNVERIFIED",
      wordpressObjectId: page.id,
      wordpressStatus: page.status ?? null,
    };
  }
  return {
    slug: input.slug,
    parentId: input.parentId,
    state: page.status === "publish" ? "EXISTS_PUBLISHED" : "EXISTS_DRAFT",
    wordpressObjectId: page.id,
    wordpressStatus: page.status,
  };
}

async function createDraftParent(input: {
  apiBaseUrl: string;
  authorization: string;
  slug: string;
  title: string;
  parentId: number;
}): Promise<WordPressHierarchyPage | null> {
  try {
    const response = await fetch(`${input.apiBaseUrl}/pages`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: input.authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: input.title,
        slug: input.slug,
        parent: input.parentId,
        status: "draft",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const body = await response.json();
    return isPage(body) ? body : null;
  } catch {
    return null;
  }
}

export async function resolveOrCreateGenesisWordPressHierarchy(input: {
  site: SiteConfiguration;
  productSlug: string;
  productTitle: string;
  stateSlug: string;
  stateTitle: string;
}): Promise<GenesisWordPressHierarchyResolution> {
  const apiBaseUrl = input.site.integrations.wordpressApiBaseUrl?.trim();
  const credentialReference = input.site.integrations.wordpressCredentialReference;
  if (!apiBaseUrl || !credentialReference) {
    return { ok: false, state: "not_configured", message: "WordPress hierarchy authority is not configured." };
  }
  const credential = resolveWordPressCredentialReference(credentialReference);
  if (!credential) {
    return { ok: false, state: "credential_unavailable", message: "WordPress hierarchy credentials could not be resolved." };
  }
  const productSlug = normalizeSlug(input.productSlug);
  const stateSlug = normalizeSlug(input.stateSlug);
  const productTitle = input.productTitle.trim();
  const stateTitle = input.stateTitle.trim();
  if (!productSlug || !stateSlug || !productTitle || !stateTitle || productSlug.includes("/") || stateSlug.includes("/")) {
    return { ok: false, state: "invalid_target", message: "Canonical product and state hierarchy identities are required." };
  }

  let authority: AuthenticatedWordPressReadAuthority;
  let normalizedApiBaseUrl: string;
  try {
    normalizedApiBaseUrl = normalizeWordPressApiBaseUrl(apiBaseUrl);
    authority = createAuthenticatedWordPressReadAuthority({
      configuration: {
        apiBaseUrl: normalizedApiBaseUrl,
        username: credential.username,
        applicationPassword: credential.applicationPassword,
      },
    });
  } catch {
    return { ok: false, state: "invalid_target", message: "The configured WordPress hierarchy target is invalid." };
  }
  const authorization = `Basic ${Buffer.from(`${credential.username}:${credential.applicationPassword}`, "utf8").toString("base64")}`;

  let product = await readExactNode({ authority, slug: productSlug, parentId: 0 });
  if (product.state === "UNVERIFIED") return { ok: false, state: "read_failed", message: "Genesis could not verify an acceptable published-or-draft product hierarchy parent.", product };
  if (product.state === "COLLISION") return { ok: false, state: "collision", message: "Multiple exact product hierarchy parents were returned. Genesis failed closed.", product };
  if (product.state === "ABSENT") {
    const created = await createDraftParent({ apiBaseUrl: normalizedApiBaseUrl, authorization, slug: productSlug, title: productTitle, parentId: 0 });
    if (!created?.id || created.status !== "draft" || normalizeSlug(created.slug ?? "") !== productSlug || created.parent !== 0) {
      return { ok: false, state: "write_failed", message: "Genesis could not create and confirm the missing product hierarchy parent as a draft.", product };
    }
    product = await readExactNode({ authority, slug: productSlug, parentId: 0 });
    if (product.state !== "EXISTS_DRAFT" || product.wordpressObjectId !== created.id) {
      return { ok: false, state: "collision", message: "Product hierarchy identity changed during draft creation. Genesis failed closed.", product };
    }
  }
  if (!product.wordpressObjectId) return { ok: false, state: "collision", message: "Product hierarchy parent has no authoritative WordPress identity.", product };

  let stateNode = await readExactNode({ authority, slug: stateSlug, parentId: product.wordpressObjectId });
  if (stateNode.state === "UNVERIFIED") return { ok: false, state: "read_failed", message: "Genesis could not verify an acceptable published-or-draft state hierarchy parent.", product, stateNode };
  if (stateNode.state === "COLLISION") return { ok: false, state: "collision", message: "Multiple exact state hierarchy parents were returned. Genesis failed closed.", product, stateNode };
  if (stateNode.state === "ABSENT") {
    const created = await createDraftParent({ apiBaseUrl: normalizedApiBaseUrl, authorization, slug: stateSlug, title: stateTitle, parentId: product.wordpressObjectId });
    if (!created?.id || created.status !== "draft" || normalizeSlug(created.slug ?? "") !== stateSlug || created.parent !== product.wordpressObjectId) {
      return { ok: false, state: "write_failed", message: "Genesis could not create and confirm the missing state hierarchy parent as a draft.", product, stateNode };
    }
    stateNode = await readExactNode({ authority, slug: stateSlug, parentId: product.wordpressObjectId });
    if (stateNode.state !== "EXISTS_DRAFT" || stateNode.wordpressObjectId !== created.id) {
      return { ok: false, state: "collision", message: "State hierarchy identity changed during draft creation. Genesis failed closed.", product, stateNode };
    }
  }
  if (!stateNode.wordpressObjectId) return { ok: false, state: "collision", message: "State hierarchy parent has no authoritative WordPress identity.", product, stateNode };

  return { ok: true, product, state: stateNode, leafParentId: stateNode.wordpressObjectId };
}
