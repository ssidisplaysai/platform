import { isIP } from "node:net";
import { lookup as dnsLookup } from "node:dns/promises";

export const GOVERNED_RENDER_CAPTURE_VERSION = "genesis-governed-render-capture-v1" as const;
export const GOVERNED_RENDER_CAPTURE_LIMITS = {
  navigationTimeoutMs: 20_000,
  captureTimeoutMs: 45_000,
  settleTimeoutMs: 5_000,
  maximumScreenshotWidth: 1_440,
  maximumScreenshotHeight: 16_000,
  maximumArtifactBytes: 12_000_000,
  maximumCaptureSetBytes: 20_000_000,
  maximumRedirects: 3,
  maximumCapturesPerRequest: 2,
  browserConcurrency: 1,
} as const;

export type GovernedCaptureMode = "CURRENT" | "RECAPTURE";
export type GovernedGeneratedPageCaptureRequest = { mode: GovernedCaptureMode };
export type GovernedSiteHomeCaptureRequest = { page: "HOME"; mode: GovernedCaptureMode };
type Lookup = (hostname: string) => Promise<readonly { address: string; family: number }[]>;
const SAFE_FAILURE_CODES = new Set(["AUTHORITY_MISMATCH", "PAGE_NOT_FOUND", "WORDPRESS_AUTH_FAILED", "CAPTURE_NAVIGATION_FAILED", "CAPTURE_REDIRECT_BLOCKED", "CAPTURE_REDIRECT_LIMIT_EXCEEDED", "CAPTURE_TIMEOUT", "ARTIFACT_TOO_LARGE", "CAPTURE_SET_TOO_LARGE", "GEOMETRY_EXTRACTION_FAILED", "VISUAL_CERTIFICATION_IDENTITY_ALREADY_EXISTS", "CAPTURE_ALREADY_RUNNING", "CAPTURE_CONCURRENCY_LIMIT", "CAPTURE_REQUEST_INVALID", "CAPTURE_TARGET_INVALID", "CAPTURE_ORIGIN_NOT_ALLOWED", "CAPTURE_INTERNAL_TARGET_INVALID", "CAPTURE_INTERNAL_ORIGIN_NOT_CONFIGURED", "CAPTURE_HTTPS_REQUIRED", "CAPTURE_PRIVATE_ADDRESS_BLOCKED", "CAPTURE_DIMENSIONS_EXCEEDED", "CAPTURE_RENDER_IDENTITY_MISMATCH", "CAPTURE_BROWSER_UNAVAILABLE"]);

export function governedCaptureFailureCode(error: unknown): string {
  const candidate = error instanceof Error ? error.message.split(":")[0] : "";
  return SAFE_FAILURE_CODES.has(candidate) ? candidate : "CAPTURE_FAILED";
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function rejectsClientLocation(value: unknown): boolean {
  if (typeof value === "string") return /^(?:https?|file|ftp|data|javascript):/i.test(value.trim());
  if (Array.isArray(value)) return value.some(rejectsClientLocation);
  if (value && typeof value === "object") return Object.entries(value).some(([key, item]) => /url|uri|origin|host|hostname|port|path/i.test(key) || rejectsClientLocation(item));
  return false;
}

export function parseGeneratedPageCaptureRequest(value: unknown): GovernedGeneratedPageCaptureRequest {
  const input = record(value);
  if (!input || rejectsClientLocation(input) || Object.keys(input).some((key) => key !== "mode")) throw new Error("CAPTURE_REQUEST_INVALID");
  const mode = input.mode ?? "CURRENT";
  if (mode !== "CURRENT" && mode !== "RECAPTURE") throw new Error("CAPTURE_REQUEST_INVALID");
  return { mode };
}

export function parseSiteHomeCaptureRequest(value: unknown): GovernedSiteHomeCaptureRequest {
  const input = record(value);
  if (!input || rejectsClientLocation(input) || Object.keys(input).some((key) => key !== "page" && key !== "mode") || input.page !== "HOME") throw new Error("CAPTURE_REQUEST_INVALID");
  const mode = input.mode ?? "CURRENT";
  if (mode !== "CURRENT" && mode !== "RECAPTURE") throw new Error("CAPTURE_REQUEST_INVALID");
  return { page: "HOME", mode };
}

function ipv4Private(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

export function isDisallowedCaptureAddress(address: string): boolean {
  const normalized = address.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized.startsWith("::ffff:")) return ipv4Private(normalized.slice(7));
  const family = isIP(normalized);
  if (family === 4) return ipv4Private(normalized);
  if (family !== 6) return true;
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || /^fe[89ab]/.test(normalized) || normalized.startsWith("ff");
}

async function systemLookup(hostname: string): Promise<readonly { address: string; family: number }[]> {
  return dnsLookup(hostname, { all: true, verbatim: true });
}

export async function validateGovernedCaptureUrl(input: {
  targetUrl: string;
  allowedOrigins: readonly string[];
  internalGenesisOrigin?: string | null;
  lookup?: Lookup;
}): Promise<{ url: URL; resolvedAddresses: readonly string[]; internal: boolean }> {
  let url: URL;
  try { url = new URL(input.targetUrl); } catch { throw new Error("CAPTURE_TARGET_INVALID"); }
  if (url.username || url.password || url.hash) throw new Error("CAPTURE_TARGET_INVALID");
  const allowed = input.allowedOrigins.map((origin) => new URL(origin).origin);
  if (!allowed.includes(url.origin)) throw new Error("CAPTURE_ORIGIN_NOT_ALLOWED");
  const internal = Boolean(input.internalGenesisOrigin && url.origin === new URL(input.internalGenesisOrigin).origin);
  if (internal) {
    if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "::1"].includes(url.hostname)) throw new Error("CAPTURE_INTERNAL_TARGET_INVALID");
    return { url, resolvedAddresses: [url.hostname], internal: true };
  }
  if (url.protocol !== "https:") throw new Error("CAPTURE_HTTPS_REQUIRED");
  if (isIP(url.hostname) && isDisallowedCaptureAddress(url.hostname)) throw new Error("CAPTURE_PRIVATE_ADDRESS_BLOCKED");
  const answers = await (input.lookup ?? systemLookup)(url.hostname);
  if (answers.length === 0 || answers.some((answer) => isDisallowedCaptureAddress(answer.address))) throw new Error("CAPTURE_PRIVATE_ADDRESS_BLOCKED");
  return { url, resolvedAddresses: answers.map((answer) => answer.address), internal: false };
}

export function validateCaptureRedirectChain(input: { requestedUrl: string; responseUrls: readonly string[]; allowedOrigins: readonly string[] }): void {
  if (input.responseUrls.length - 1 > GOVERNED_RENDER_CAPTURE_LIMITS.maximumRedirects) throw new Error("CAPTURE_REDIRECT_LIMIT_EXCEEDED");
  const allowed = new Set(input.allowedOrigins.map((origin) => new URL(origin).origin));
  for (const value of [input.requestedUrl, ...input.responseUrls]) {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error("CAPTURE_REDIRECT_BLOCKED"); }
    if (!allowed.has(url.origin)) throw new Error("CAPTURE_REDIRECT_BLOCKED");
  }
}

const activeCaptureKeys = new Set<string>();
let activeBrowserCaptures = 0;

export async function withGovernedCaptureLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  if (activeCaptureKeys.has(key)) throw new Error("CAPTURE_ALREADY_RUNNING");
  if (activeBrowserCaptures >= GOVERNED_RENDER_CAPTURE_LIMITS.browserConcurrency) throw new Error("CAPTURE_CONCURRENCY_LIMIT");
  activeCaptureKeys.add(key);
  activeBrowserCaptures += 1;
  try { return await operation(); } finally { activeCaptureKeys.delete(key); activeBrowserCaptures -= 1; }
}