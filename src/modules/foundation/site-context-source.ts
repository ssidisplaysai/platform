import { FOUNDATION_SITE_FIXTURES } from "./site-fixtures";
import type { SiteConfiguration } from "./types";

export function listFoundationSitesForContext(): readonly SiteConfiguration[] {
  return FOUNDATION_SITE_FIXTURES.map((site) => structuredClone(site));
}
