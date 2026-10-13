import "server-only";

import { isIP } from "node:net";
import type { LookupFunction } from "node:net";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isUnsafePublicAddress } from "./public-network-address";

export type WordPressOnboardingIntent = "fresh" | "existing";

export type IntegrationComplexity =
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "REBUILD_RECOMMENDED";

export type PublicWordPressPreflightResult = {
  ready: boolean;
  domain: string;
  canonicalUrl: string;
  adminUrl: string;
  apiBaseUrl: string;
  checks: {
    https: boolean;
    publicHost: boolean;
    reachable: boolean;
    wordpressDetected: boolean;
    adminReachable: boolean;
    restAvailable: boolean;
    canonicalConsistent: boolean;
  };
  integration: {
    complexity: IntegrationComplexity;
    effort: "LOW" | "MODERATE" | "HIGH";
    signals: string[];
  };
  blockers: string[];
};

type LookupAddress = { address: string; family: number };

type PreflightResponse = {
  ok: boolean;
  status: number;
  url: string;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
};

export type WordPressPublicPreflightDependencies = {
  resolveHost?: (hostname: string) => Promise<LookupAddress[]>;
  fetcher?: (
    url: string,
    init: {
      method: "GET";
      headers: Record<string, string>;
      redirect: "manual";
      signal: AbortSignal;
    },
  ) => Promise<PreflightResponse>;
};

export function inferWordPressEndpoints(input: {
  domain: string;
  apiBaseUrl?: string | null;
}): {
  domain: string;
  canonicalUrl: string;
  adminUrl: string;
  apiBaseUrl: string;
} {
  const rawDomain = input.domain.trim();
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(rawDomain)
    ? rawDomain
    : `https://${rawDomain}`;
  const siteUrl = new URL(candidate);

  if (siteUrl.protocol !== "https:") {
    throw new Error("Fresh-site onboarding requires HTTPS.");
  }

  if (siteUrl.username || siteUrl.password) {
    throw new Error("Credential-bearing URLs are not allowed.");
  }

  if (siteUrl.port) {
    throw new Error("Custom ports are not supported for public onboarding.");
  }

  if (siteUrl.pathname !== "/" || siteUrl.search || siteUrl.hash) {
    throw new Error("Enter a domain without a path, query, or fragment.");
  }

  const domain = siteUrl.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !domain
    || domain === "localhost"
    || domain.endsWith(".localhost")
    || (isIP(domain) !== 0 && isUnsafePublicAddress(domain))
  ) {
    throw new Error("A public WordPress domain is required.");
  }

  const canonicalUrl = `https://${domain}`;
  const apiUrl = input.apiBaseUrl?.trim()
    ? new URL(input.apiBaseUrl.trim())
    : new URL(`${canonicalUrl}/wp-json/wp/v2`);

  if (
    apiUrl.protocol !== "https:"
    || apiUrl.username
    || apiUrl.password
    || apiUrl.port
    || apiUrl.hostname.toLowerCase().replace(/\.$/, "") !== domain
  ) {
    throw new Error("The WordPress API override must use HTTPS on the site domain.");
  }

  return {
    domain,
    canonicalUrl,
    adminUrl: `${canonicalUrl}/wp-admin`,
    apiBaseUrl: apiUrl.toString().replace(/\/$/, ""),
  };
}

function finalHostname(response: PreflightResponse): string | null {
  try {
    return new URL(response.url).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

function createPinnedFetcher(addresses: LookupAddress[]): NonNullable<WordPressPublicPreflightDependencies["fetcher"]> {
  const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
    if (options.all) {
      callback(null, addresses);
      return;
    }

    const address = addresses[0];
    callback(null, address.address, address.family);
  };

  return (url, init) => new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const request = httpsRequest(parsedUrl, {
      method: init.method,
      headers: init.headers,
      signal: init.signal,
      servername: parsedUrl.hostname,
      lookup: pinnedLookup,
    }, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;

      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 1_048_576) {
          response.destroy(new Error("WordPress preflight response exceeded 1 MB."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        resolve({
          ok: Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 300),
          status: response.statusCode ?? 0,
          url,
          headers: {
            get(name: string) {
              const value = response.headers[name.toLowerCase()];
              return Array.isArray(value) ? value.join(", ") : value ?? null;
            },
          },
          async json() {
            return JSON.parse(body) as unknown;
          },
        });
      });
    });
    request.on("error", reject);
    request.end();
  });
}

export async function runPublicWordPressPreflight(
  input: {
    domain: string;
    apiBaseUrl?: string | null;
    intent: WordPressOnboardingIntent;
  },
  dependencies: WordPressPublicPreflightDependencies = {},
): Promise<PublicWordPressPreflightResult> {
  const endpoints = inferWordPressEndpoints(input);
  const resolveHost = dependencies.resolveHost ?? (async (hostname) =>
    lookup(hostname, { all: true, verbatim: true }));
  const addresses = await resolveHost(endpoints.domain);

  if (addresses.length === 0 || addresses.some((entry) => isUnsafePublicAddress(entry.address))) {
    throw new Error("The supplied domain does not resolve exclusively to public IP addresses.");
  }

  const fetcher = dependencies.fetcher ?? createPinnedFetcher(addresses);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const request = async (initialUrl: string): Promise<PreflightResponse> => {
      let currentUrl = initialUrl;

      for (let redirects = 0; redirects <= 5; redirects += 1) {
        const response = await fetcher(currentUrl, {
          method: "GET",
          headers: { Accept: "application/json, text/html;q=0.9" },
          redirect: "manual",
          signal: controller.signal,
        });
        if (![301, 302, 303, 307, 308].includes(response.status)) return response;

        const location = response.headers.get("location");
        if (!location) return response;
        const redirected = new URL(location, currentUrl);
        if (
          redirected.protocol !== "https:"
          || redirected.hostname.toLowerCase().replace(/\.$/, "") !== endpoints.domain
          || redirected.username
          || redirected.password
          || redirected.port
        ) {
          return { ...response, url: redirected.toString() };
        }
        currentUrl = redirected.toString();
      }

      throw new Error("WordPress preflight exceeded the redirect limit.");
    };
    const [home, admin, rest] = await Promise.all([
      request(endpoints.canonicalUrl),
      request(endpoints.adminUrl),
      request(endpoints.apiBaseUrl),
    ]);
    const canonicalConsistent = [home, admin, rest].every(
      (response) => finalHostname(response) === endpoints.domain,
    );
    const generator = home.headers.get("x-generator") ?? "";
    const link = home.headers.get("link") ?? "";
    let restBody: unknown = null;
    if (rest.ok) {
      try {
        restBody = await rest.json();
      } catch {
        restBody = null;
      }
    }
    const restLooksLikeWordPress = Boolean(
      restBody
      && typeof restBody === "object"
      && !Array.isArray(restBody)
      && (
        (restBody as { namespace?: unknown }).namespace === "wp/v2"
        || typeof (restBody as { routes?: unknown }).routes === "object"
      ),
    );
    const wordpressDetected = restLooksLikeWordPress
      || /wordpress/i.test(generator)
      || /wp-json/i.test(link);
    const checks = {
      https: true,
      publicHost: true,
      reachable: home.ok,
      wordpressDetected,
      adminReachable: admin.ok || [301, 302, 303, 307, 308, 401, 403].includes(admin.status),
      restAvailable: rest.ok && restBody !== null,
      canonicalConsistent,
    };
    const blockers = Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([key]) => key.replace(/([A-Z])/g, " $1").toLowerCase());
    const lowComplexity = input.intent === "fresh" && blockers.length === 0;

    return {
      ready: blockers.length === 0,
      ...endpoints,
      checks,
      integration: {
        complexity: lowComplexity ? "LOW" : blockers.length <= 1 ? "MODERATE" : "HIGH",
        effort: lowComplexity ? "LOW" : blockers.length <= 1 ? "MODERATE" : "HIGH",
        signals: input.intent === "fresh"
          ? ["Greenfield WordPress mode", "No legacy content migration required"]
          : ["Existing-site review required"],
      },
      blockers,
    };
  } finally {
    clearTimeout(timeout);
  }
}