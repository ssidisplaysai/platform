export type PublishedLinkClassification =
  | "VALID"
  | "BOT_RESTRICTED_OFFICIAL_URL"
  | "BROKEN_LINK"
  | "NETWORK_ERROR";

const HEAVYM_OFFICIAL_URL = "https://www.heavym.net/";

export function classifyPublishedLinkResult(input: {
  requestedUrl: string;
  status: number | null;
  resolvedUrl: string | null;
  networkError?: boolean;
}): PublishedLinkClassification {
  if (input.networkError || input.status === null || !input.resolvedUrl) return "NETWORK_ERROR";
  let requested: URL;
  let resolved: URL;
  try {
    requested = new URL(input.requestedUrl);
    resolved = new URL(input.resolvedUrl);
  } catch {
    return "BROKEN_LINK";
  }
  if (
    input.requestedUrl === HEAVYM_OFFICIAL_URL
    && input.status === 403
    && requested.protocol === "https:"
    && requested.hostname === "www.heavym.net"
    && resolved.hostname.replace(/^www\./, "") === "heavym.net"
  ) return "BOT_RESTRICTED_OFFICIAL_URL";
  return input.status >= 200 && input.status < 400 ? "VALID" : "BROKEN_LINK";
}
