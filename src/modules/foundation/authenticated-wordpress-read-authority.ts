export type AuthenticatedWordPressReadConfiguration = {
  apiBaseUrl: string;
  username: string;
  applicationPassword: string;
  timeoutMs?: number;
};

export type AuthenticatedWordPressReadFailureReason =
  | "AUTH_FAILURE"
  | "NOT_FOUND"
  | "READ_TIMEOUT"
  | "NETWORK_ERROR"
  | "MALFORMED_RESPONSE";

export type AuthenticatedWordPressReadResult =
  | { ok: true; body: unknown }
  | { ok: false; reason: AuthenticatedWordPressReadFailureReason };

type FetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

export type AuthenticatedWordPressGetFetcher = (
  url: string,
  init: {
    method: "GET";
    headers: Record<string, string>;
    cache: "no-store";
    signal: AbortSignal;
  },
) => Promise<FetchResponse>;

export type AuthenticatedWordPressReadAuthority = {
  getJson(input: { path: string; query?: URLSearchParams }): Promise<AuthenticatedWordPressReadResult>;
};

export function normalizeWordPressApiBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("WordPress read authority must use HTTPS outside localhost.");
  }
  const marker = "/wp-json/wp/v2";
  const markerIndex = url.pathname.indexOf(marker);
  const pathname = markerIndex >= 0
    ? url.pathname.slice(0, markerIndex + marker.length)
    : `${url.pathname.replace(/\/$/, "")}${marker}`;
  return `${url.protocol}//${url.host}${pathname}`;
}

export function createAuthenticatedWordPressReadAuthority(input: {
  configuration: AuthenticatedWordPressReadConfiguration;
  fetcher?: AuthenticatedWordPressGetFetcher;
}): AuthenticatedWordPressReadAuthority {
  const apiBaseUrl = normalizeWordPressApiBaseUrl(input.configuration.apiBaseUrl);
  const timeoutMs = Math.min(Math.max(input.configuration.timeoutMs ?? 10_000, 1_000), 30_000);
  const authorization = `Basic ${Buffer.from(
    `${input.configuration.username}:${input.configuration.applicationPassword}`,
  ).toString("base64")}`;
  const fetcher = input.fetcher ?? (fetch as unknown as AuthenticatedWordPressGetFetcher);

  return {
    async getJson({ path, query }) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;
        if (
          normalizedPath.includes("..")
          || normalizedPath.includes("?")
          || normalizedPath.includes("#")
          || normalizedPath.includes("://")
          || !/^\/[A-Za-z0-9_/-]+$/.test(normalizedPath)
        ) {
          return { ok: false, reason: "NETWORK_ERROR" };
        }
        const authoritativeQuery = new URLSearchParams(query);
        authoritativeQuery.set("_genesis_read_nonce", `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        const response = await fetcher(`${apiBaseUrl}${normalizedPath}?${authoritativeQuery.toString()}`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: authorization,
            "Cache-Control": "no-cache, no-store, max-age=0",
            Pragma: "no-cache",
          },
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401 || response.status === 403) return { ok: false, reason: "AUTH_FAILURE" };
        if (response.status === 404) return { ok: false, reason: "NOT_FOUND" };
        if (!response.ok) return { ok: false, reason: "NETWORK_ERROR" };
        try {
          return { ok: true, body: await response.json() };
        } catch {
          return { ok: false, reason: "MALFORMED_RESPONSE" };
        }
      } catch (error) {
        return {
          ok: false,
          reason: error instanceof DOMException && error.name === "AbortError" ? "READ_TIMEOUT" : "NETWORK_ERROR",
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}