export function slugifySiteName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createSiteId(organizationId: string, slug: string): string {
  return `site-${organizationId}-${slug}`;
}