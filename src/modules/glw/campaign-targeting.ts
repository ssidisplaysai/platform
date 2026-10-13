import { GLW_CITIES } from "@/modules/glw/page-generation";
import { GLW_CAMPAIGN_US_STATES } from "@/modules/glw/campaign-geography";
import type { GlwCampaignCityTarget, GlwCampaignPageType } from "@/modules/glw/campaign-types";

export type GlwCampaignGeographyMode =
  | "ALL_STATES"
  | "SELECTED_STATES"
  | "CITIES_BY_STATE"
  | "SELECTED_CITIES";

export type GlwCityScopeMode = "ALL_SUPPORTED" | "SELECTED";

export type GlwResolvedTarget =
  | {
      targetType: "STATE";
      identity: string;
      stateCode: string;
      label: string;
    }
  | {
      targetType: "CITY";
      identity: string;
      stateCode: string;
      citySlug: string;
      cityName: string;
      label: string;
    };

export type GlwResolvedGeography = {
  mode: GlwCampaignGeographyMode;
  targetType: "STATE" | "CITY";
  pageType: GlwCampaignPageType;
  stateCodes: readonly string[];
  cityTargets: readonly GlwCampaignCityTarget[];
  targets: readonly GlwResolvedTarget[];
};

export function createCityIdentityKey(input: {
  stateCode: string;
  citySlug: string;
}): string {
  return `${input.stateCode.trim().toUpperCase()}|${input.citySlug.trim().toLowerCase()}`;
}

function normalizeStateCode(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeCitySlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function canonicalStateName(stateCode: string): string {
  return GLW_CAMPAIGN_US_STATES.find((state) => state.code === stateCode)?.name ?? stateCode;
}

function byStateThenCity(left: { stateCode: string; citySlug: string }, right: { stateCode: string; citySlug: string }): number {
  const stateOrder = left.stateCode.localeCompare(right.stateCode);
  if (stateOrder !== 0) {
    return stateOrder;
  }
  return left.citySlug.localeCompare(right.citySlug);
}

function uniqueStateCodes(stateCodes: readonly string[]): readonly string[] {
  return Array.from(new Set(stateCodes.map((stateCode) => normalizeStateCode(stateCode)))).sort();
}

function cityByIdentity(identity: string): { stateCode: string; citySlug: string; cityName: string } | null {
  const [stateCodeRaw, citySlugRaw] = identity.split("|");
  const stateCode = normalizeStateCode(stateCodeRaw ?? "");
  const citySlug = normalizeCitySlug(citySlugRaw ?? "");
  if (!stateCode || !citySlug) {
    return null;
  }

  const city = GLW_CITIES.find((candidate) => candidate.stateCode === stateCode && candidate.slug === citySlug);
  if (!city) {
    return null;
  }

  return {
    stateCode,
    citySlug,
    cityName: city.name,
  };
}

export function resolveGlwCampaignGeography(input: {
  mode: GlwCampaignGeographyMode;
  selectedStateCodes: readonly string[];
  selectedCityIdentities: readonly string[];
  citiesByStateScope: GlwCityScopeMode;
}): GlwResolvedGeography {
  const selectedStateCodes = uniqueStateCodes(input.selectedStateCodes);

  if (input.mode === "ALL_STATES") {
    const states = GLW_CAMPAIGN_US_STATES.map((state) => ({
      targetType: "STATE" as const,
      identity: state.code,
      stateCode: state.code,
      label: `${state.code} - ${state.name}`,
    }));

    return {
      mode: input.mode,
      targetType: "STATE",
      pageType: "state_service",
      stateCodes: states.map((target) => target.stateCode),
      cityTargets: [],
      targets: states,
    };
  }

  if (input.mode === "SELECTED_STATES") {
    const targets = selectedStateCodes.map((stateCode) => ({
      targetType: "STATE" as const,
      identity: stateCode,
      stateCode,
      label: `${stateCode} - ${canonicalStateName(stateCode)}`,
    }));

    return {
      mode: input.mode,
      targetType: "STATE",
      pageType: "state_service",
      stateCodes: selectedStateCodes,
      cityTargets: [],
      targets,
    };
  }

  if (input.mode === "CITIES_BY_STATE") {
    const cities = input.citiesByStateScope === "ALL_SUPPORTED"
      ? GLW_CITIES
        .filter((city) => selectedStateCodes.includes(city.stateCode))
        .map((city) => ({
          stateCode: city.stateCode,
          citySlug: city.slug,
          cityName: city.name,
        }))
      : input.selectedCityIdentities
        .map((identity) => cityByIdentity(identity))
        .filter((city): city is { stateCode: string; citySlug: string; cityName: string } => city !== null)
        .filter((city) => selectedStateCodes.includes(city.stateCode));

    const deduped = Array.from(new Map(
      cities.map((city) => [createCityIdentityKey(city), city]),
    ).values()).sort(byStateThenCity);

    const cityTargets = deduped.map((city) => ({
      stateCode: city.stateCode,
      citySlug: city.citySlug,
      cityName: city.cityName,
    }));
    const stateCodes = uniqueStateCodes(cityTargets.map((city) => city.stateCode));
    const targets: GlwResolvedTarget[] = cityTargets.map((city) => ({
      targetType: "CITY",
      identity: createCityIdentityKey(city),
      stateCode: city.stateCode,
      citySlug: city.citySlug,
      cityName: city.cityName,
      label: `${city.cityName}, ${city.stateCode}`,
    }));

    return {
      mode: input.mode,
      targetType: "CITY",
      pageType: "city_service",
      stateCodes,
      cityTargets,
      targets,
    };
  }

  const selectedCities = input.selectedCityIdentities
    .map((identity) => cityByIdentity(identity))
    .filter((city): city is { stateCode: string; citySlug: string; cityName: string } => city !== null);
  const deduped = Array.from(new Map(
    selectedCities.map((city) => [createCityIdentityKey(city), city]),
  ).values()).sort(byStateThenCity);
  const cityTargets = deduped.map((city) => ({
    stateCode: city.stateCode,
    citySlug: city.citySlug,
    cityName: city.cityName,
  }));
  const stateCodes = uniqueStateCodes(cityTargets.map((city) => city.stateCode));
  const targets: GlwResolvedTarget[] = cityTargets.map((city) => ({
    targetType: "CITY",
    identity: createCityIdentityKey(city),
    stateCode: city.stateCode,
    citySlug: city.citySlug,
    cityName: city.cityName,
    label: `${city.cityName}, ${city.stateCode}`,
  }));

  return {
    mode: input.mode,
    targetType: "CITY",
    pageType: "city_service",
    stateCodes,
    cityTargets,
    targets,
  };
}