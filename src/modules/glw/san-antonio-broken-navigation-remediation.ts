import { createHash } from "node:crypto";

export const SAN_ANTONIO_BROKEN_NAVIGATION_REMEDIATION_OPERATION = "SAN_ANTONIO_BROKEN_NAVIGATION_REMEDIATION_V1" as const;
export const SAN_ANTONIO_BROKEN_NAVIGATION_BEFORE_HASH = "fb5ad5ab311b5bc3c18ad9921efb88dd765171ff5cd69edab5d743ac8a4e05a2" as const;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const SAN_ANTONIO_LINK_REMEDIATIONS = [
  { label: "Homeline Series", oldHref: "/homeline-series/", disposition: "REPLACE_WITH_LIVE_EQUIVALENT", newHref: "/homeline-projector-enclosure/" },
  { label: "Outdoor Entertainment", oldHref: "/outdoor-entertainment/", disposition: "REPLACE_WITH_HIGHER_LEVEL_AUTHORITY", newHref: "/ip65-projector-enclosures-for-outdoor-applications/" },
  { label: "Education", oldHref: "/education/", disposition: "REPLACE_WITH_LIVE_EQUIVALENT", newHref: "/ceiling-mounted-projector-enclosures-for-educational-facilities/" },
  { label: "Houses of Worship", oldHref: "/houses-of-worship/", disposition: "REPLACE_WITH_LIVE_EQUIVALENT", newHref: "/fan-cooled-projector-enclosure-for-churches/" },
  { label: "Museums & Exhibits", oldHref: "/museums-exhibits/", disposition: "REPLACE_WITH_LIVE_EQUIVALENT", newHref: "/indoor-projector-enclosures-for-museums/" },
  { label: "Stadiums & Arenas", oldHref: "/stadiums-arenas/", disposition: "REPLACE_WITH_HIGHER_LEVEL_AUTHORITY", newHref: "/water-resistant-projector-enclosures-outdoor-use/" },
  { label: "Government & Military", oldHref: "/government-military/", disposition: "REPLACE_WITH_LIVE_EQUIVALENT", newHref: "/projector-enclosures-for-government-projects/" },
  { label: "Request a Quote", oldHref: "/request-a-quote/", disposition: "REPLACE_WITH_HIGHER_LEVEL_AUTHORITY", newHref: "/contact-us-projection-enclosure/" },
  { label: "Privacy Policy", oldHref: "/privacy-policy/", disposition: "REMOVE_LINK_KEEP_TEXT", newHref: null },
  { label: "Terms & Conditions", oldHref: "/terms/", disposition: "REMOVE_LINK_KEEP_TEXT", newHref: null },
] as const;

export function applySanAntonioBrokenNavigationRemediation(input: string) {
  const raw = input.trim(); if (hash(raw) !== SAN_ANTONIO_BROKEN_NAVIGATION_BEFORE_HASH) throw new Error("SAN_ANTONIO_BROKEN_NAVIGATION_SOURCE_DRIFT"); let output = raw;
  for (const item of SAN_ANTONIO_LINK_REMEDIATIONS) { if (!output.includes(`href="${item.oldHref}"`)) throw new Error(`SAN_ANTONIO_BROKEN_LINK_MISSING:${item.oldHref}`); output = item.newHref ? output.replace(`href="${item.oldHref}"`, `href="${item.newHref}"`) : output.replace(`<a href="${item.oldHref}">${item.label.replace("&", "&amp;")}</a>`, `<span data-genesis-removed-dead-link="${item.oldHref}">${item.label.replace("&", "&amp;")}</span>`); }
  if (SAN_ANTONIO_LINK_REMEDIATIONS.some((item) => output.includes(`href="${item.oldHref}"`))) throw new Error("SAN_ANTONIO_BROKEN_NAVIGATION_TRANSFORM_INCOMPLETE"); return output;
}

export function removeSanAntonioBrokenNavigationRemediation(input: string) { let output = input; for (const item of [...SAN_ANTONIO_LINK_REMEDIATIONS].reverse()) output = item.newHref ? output.replace(`href="${item.newHref}"`, `href="${item.oldHref}"`) : output.replace(`<span data-genesis-removed-dead-link="${item.oldHref}">${item.label.replace("&", "&amp;")}</span>`, `<a href="${item.oldHref}">${item.label.replace("&", "&amp;")}</a>`); return output; }