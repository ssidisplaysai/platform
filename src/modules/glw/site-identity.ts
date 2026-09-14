export function canonicalizeGlwSiteHost(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  } catch {
    return "";
  }
}

export function glwSiteHostsMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const canonicalLeft = canonicalizeGlwSiteHost(left);
  return Boolean(canonicalLeft && canonicalLeft === canonicalizeGlwSiteHost(right));
}