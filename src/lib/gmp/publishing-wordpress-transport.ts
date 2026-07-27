import "server-only";
import type { GmpWordpressTransport } from "./publishing-adapters";
import type { GmpPublishingDestination } from "./publishing-models";
import { createEnvironmentDestinationCredentialProvider, type GmpDestinationCredentialProvider } from "./publishing-credentials";

type WordpressUpsertPayload = {
  title?: string;
  slug?: string;
  status?: string;
  content?: string;
  excerpt?: string;
  featured_media?: number;
  categories?: number[];
  tags?: number[];
  author?: number;
  date_gmt?: string;
  meta?: Record<string, unknown>;
};

type WordpressPostResponse = {
  id: number;
  type?: string;
  status?: string;
  slug?: string;
  modified_gmt?: string;
  link?: string;
  guid?: { rendered?: string };
  content?: { rendered?: string };
  title?: { rendered?: string };
  excerpt?: { rendered?: string };
  meta?: Record<string, unknown>;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function redactError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
  return message.replace(/(authorization|password|token|secret)=([^\s&]+)/gi, "$1=[REDACTED]");
}

function chooseWordpressContentType(destination: GmpPublishingDestination): "pages" | "posts" {
  const configured = typeof destination.configuration?.contentType === "string"
    ? destination.configuration.contentType.toLowerCase()
    : "pages";
  return configured === "posts" ? "posts" : "pages";
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function toArrayOfNumbers(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const parsed = value.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry));
  return parsed.length > 0 ? parsed : undefined;
}

function toWordpressPayload(input: Record<string, unknown>, scheduleAtIso?: string): WordpressUpsertPayload {
  const content = toRecord(input.content);
  const seo = toRecord(input.seo);
  const customFields = toRecord(input.customFields);

  const meta: Record<string, unknown> = {
    ...customFields,
    gmp_seo_title: seo.seoTitle,
    gmp_meta_description: seo.metaDescription,
    gmp_canonical_url: seo.canonicalUrl,
  };

  const payload: WordpressUpsertPayload = {
    title: typeof input.title === "string" ? input.title : undefined,
    slug: typeof input.slug === "string" ? input.slug : undefined,
    status: typeof input.status === "string" ? input.status : "draft",
    content: typeof content.html === "string" ? content.html : undefined,
    excerpt: typeof input.excerpt === "string" ? input.excerpt : undefined,
    featured_media: Number.isFinite(Number(input.featuredMediaId)) ? Number(input.featuredMediaId) : undefined,
    categories: toArrayOfNumbers(input.categories),
    tags: toArrayOfNumbers(input.tags),
    author: Number.isFinite(Number(input.author)) ? Number(input.author) : undefined,
    meta,
  };

  if (scheduleAtIso) {
    payload.status = "future";
    payload.date_gmt = new Date(scheduleAtIso).toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  return payload;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }
  return response.text().catch(() => "");
}

async function wpRequest<T>(input: {
  destination: GmpPublishingDestination;
  credentialProvider: GmpDestinationCredentialProvider;
  path: string;
  method?: "GET" | "POST" | "DELETE";
  body?: Record<string, unknown>;
}): Promise<T> {
  const credential = await input.credentialProvider.resolveDestinationCredential(input.destination);
  if (!credential) {
    throw new Error("WordPress credential is not configured for destination.");
  }

  const authToken = Buffer.from(`${credential.username}:${credential.applicationPassword}`, "utf8").toString("base64");
  const url = `${normalizeBaseUrl(input.destination.baseUrl)}/wp-json/${input.path.replace(/^\/+/, "")}`;

  const response = await fetch(url, {
    method: input.method ?? "GET",
    headers: {
      Authorization: `Basic ${authToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
    cache: "no-store",
  });

  const parsed = await parseResponseBody(response);
  if (!response.ok) {
    const errorMessage = typeof parsed === "string"
      ? parsed
      : typeof parsed === "object" && parsed !== null && typeof (parsed as Record<string, unknown>).message === "string"
        ? String((parsed as Record<string, unknown>).message)
        : `HTTP ${response.status}`;
    throw new Error(`WordPress request failed (${response.status}): ${errorMessage}`);
  }

  return parsed as T;
}

export function createWordpressTransport(options?: {
  credentialProvider?: GmpDestinationCredentialProvider;
}): GmpWordpressTransport {
  const credentialProvider = options?.credentialProvider ?? createEnvironmentDestinationCredentialProvider();

  return {
    async validateConnection(destination) {
      try {
        const credentialStatus = await credentialProvider.validateDestinationCredential(destination);
        if (!credentialStatus.ok) {
          return {
            ok: false,
            warnings: [],
            blockingIssues: [credentialStatus.reason ?? "credential_invalid"],
          };
        }

        const root = await wpRequest<Record<string, unknown>>({
          destination,
          credentialProvider,
          path: "",
        });

        const usersMe = await wpRequest<Record<string, unknown>>({
          destination,
          credentialProvider,
          path: "wp/v2/users/me?context=edit",
        });

        const warnings: string[] = [];
        if (typeof root.name !== "string") warnings.push("wordpress_site_name_unavailable");
        if (typeof usersMe.id !== "number") warnings.push("wordpress_user_identity_unavailable");

        return {
          ok: true,
          warnings,
          blockingIssues: [],
        };
      } catch (error) {
        return {
          ok: false,
          warnings: [],
          blockingIssues: [redactError(error)],
        };
      }
    },

    async upsertContent(input) {
      try {
        const contentType = chooseWordpressContentType(input.destination);
        const payload = toWordpressPayload(input.payload, input.scheduleAtIso);
        const endpoint = input.remoteObjectId
          ? `wp/v2/${contentType}/${encodeURIComponent(input.remoteObjectId)}?context=edit`
          : `wp/v2/${contentType}?context=edit`;

        const response = await wpRequest<WordpressPostResponse>({
          destination: input.destination,
          credentialProvider,
          path: endpoint,
          method: "POST",
          body: payload as unknown as Record<string, unknown>,
        });

        const externalUrl = response.link
          ?? response.guid?.rendered
          ?? `${normalizeBaseUrl(input.destination.baseUrl)}/${response.slug ?? ""}`;

        return {
          success: true,
          externalObjectType: response.type ?? contentType,
          externalObjectId: String(response.id),
          externalRevisionId: response.modified_gmt ?? undefined,
          externalUrl,
          status: response.status ?? (input.scheduleAtIso ? "scheduled" : "published"),
          response: {
            id: response.id,
            type: response.type,
            status: response.status,
            slug: response.slug,
            modified_gmt: response.modified_gmt,
            link: response.link,
          },
        };
      } catch (error) {
        return {
          success: false,
          externalObjectType: "",
          externalObjectId: "",
          externalUrl: "",
          status: "failed",
          response: {
            error: redactError(error),
          },
        };
      }
    },

    async getRemoteState(input) {
      try {
        const contentType = chooseWordpressContentType(input.destination);
        const response = await wpRequest<WordpressPostResponse>({
          destination: input.destination,
          credentialProvider,
          path: `wp/v2/${contentType}/${encodeURIComponent(input.remoteObjectId)}?context=edit`,
          method: "GET",
        });

        return {
          id: String(response.id),
          type: response.type,
          status: response.status,
          slug: response.slug,
          title: response.title?.rendered ?? "",
          excerpt: response.excerpt?.rendered ?? "",
          content: response.content?.rendered ?? "",
          modified_gmt: response.modified_gmt,
          link: response.link ?? response.guid?.rendered,
          meta: response.meta ?? {},
        };
      } catch {
        return null;
      }
    },
  };
}
