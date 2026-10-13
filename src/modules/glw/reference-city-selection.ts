import type { GlwCampaign } from "./campaign-types";

export type ReferenceCityOption = {
  stateCode: string;
  citySlug: string;
  cityName: string;
  label: string;
};

export function normalizeReferenceCitySlug(value?: string | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function listReferenceCityOptions(input: {
  campaign: GlwCampaign;
  stateCode: string;
}): readonly ReferenceCityOption[] {
  if (input.campaign.pageType !== "city_service") {
    return [];
  }

  const stateCode = input.stateCode.trim().toUpperCase();
  const seen = new Set<string>();
  const options: ReferenceCityOption[] = [];

  for (const target of input.campaign.cityTargets ?? []) {
    if (target.stateCode !== stateCode) continue;
    const citySlug = normalizeReferenceCitySlug(target.citySlug);
    const cityName = target.cityName.trim();
    if (!citySlug || !cityName) continue;
    if (seen.has(citySlug)) continue;
    seen.add(citySlug);
    options.push({
      stateCode,
      citySlug,
      cityName,
      label: `${cityName}, ${stateCode}`,
    });
  }

  return options;
}

export function resolveDeterministicReferenceCitySlug(input: {
  campaign: GlwCampaign;
  stateCode: string;
  preferredCitySlug?: string | null;
}): string | null {
  const options = listReferenceCityOptions({ campaign: input.campaign, stateCode: input.stateCode });
  if (!options.length) return null;

  const preferred = normalizeReferenceCitySlug(input.preferredCitySlug);
  if (preferred && options.some((option) => option.citySlug === preferred)) {
    return preferred;
  }

  return options[0].citySlug;
}

export function resolveReferenceCityFromCampaign(input: {
  campaign: GlwCampaign;
  stateCode: string;
  citySlug?: string | null;
}): { citySlug: string; cityName: string } | null {
  if (input.campaign.pageType !== "city_service") {
    return null;
  }
  const stateCode = input.stateCode.trim().toUpperCase();
  const citySlug = normalizeReferenceCitySlug(input.citySlug);
  if (!citySlug) return null;

  const match = listReferenceCityOptions({ campaign: input.campaign, stateCode }).find((option) => option.citySlug === citySlug);
  if (!match) return null;
  return { citySlug: match.citySlug, cityName: match.cityName };
}