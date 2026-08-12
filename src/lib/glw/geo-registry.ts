export type GlwStateRegistryEntry = {
  code: string;
  name: string;
  region: "Northeast" | "Midwest" | "South" | "West";
};

export const GLW_STATE_REGISTRY: GlwStateRegistryEntry[] = [
  { code: "AL", name: "Alabama", region: "South" },
  { code: "AK", name: "Alaska", region: "West" },
  { code: "AZ", name: "Arizona", region: "West" },
  { code: "AR", name: "Arkansas", region: "South" },
  { code: "CA", name: "California", region: "West" },
  { code: "CO", name: "Colorado", region: "West" },
  { code: "CT", name: "Connecticut", region: "Northeast" },
  { code: "DE", name: "Delaware", region: "South" },
  { code: "FL", name: "Florida", region: "South" },
  { code: "GA", name: "Georgia", region: "South" },
  { code: "HI", name: "Hawaii", region: "West" },
  { code: "ID", name: "Idaho", region: "West" },
  { code: "IL", name: "Illinois", region: "Midwest" },
  { code: "IN", name: "Indiana", region: "Midwest" },
  { code: "IA", name: "Iowa", region: "Midwest" },
  { code: "KS", name: "Kansas", region: "Midwest" },
  { code: "KY", name: "Kentucky", region: "South" },
  { code: "LA", name: "Louisiana", region: "South" },
  { code: "ME", name: "Maine", region: "Northeast" },
  { code: "MD", name: "Maryland", region: "South" },
  { code: "MA", name: "Massachusetts", region: "Northeast" },
  { code: "MI", name: "Michigan", region: "Midwest" },
  { code: "MN", name: "Minnesota", region: "Midwest" },
  { code: "MS", name: "Mississippi", region: "South" },
  { code: "MO", name: "Missouri", region: "Midwest" },
  { code: "MT", name: "Montana", region: "West" },
  { code: "NE", name: "Nebraska", region: "Midwest" },
  { code: "NV", name: "Nevada", region: "West" },
  { code: "NH", name: "New Hampshire", region: "Northeast" },
  { code: "NJ", name: "New Jersey", region: "Northeast" },
  { code: "NM", name: "New Mexico", region: "West" },
  { code: "NY", name: "New York", region: "Northeast" },
  { code: "NC", name: "North Carolina", region: "South" },
  { code: "ND", name: "North Dakota", region: "Midwest" },
  { code: "OH", name: "Ohio", region: "Midwest" },
  { code: "OK", name: "Oklahoma", region: "South" },
  { code: "OR", name: "Oregon", region: "West" },
  { code: "PA", name: "Pennsylvania", region: "Northeast" },
  { code: "RI", name: "Rhode Island", region: "Northeast" },
  { code: "SC", name: "South Carolina", region: "South" },
  { code: "SD", name: "South Dakota", region: "Midwest" },
  { code: "TN", name: "Tennessee", region: "South" },
  { code: "TX", name: "Texas", region: "South" },
  { code: "UT", name: "Utah", region: "West" },
  { code: "VT", name: "Vermont", region: "Northeast" },
  { code: "VA", name: "Virginia", region: "South" },
  { code: "WA", name: "Washington", region: "West" },
  { code: "WV", name: "West Virginia", region: "South" },
  { code: "WI", name: "Wisconsin", region: "Midwest" },
  { code: "WY", name: "Wyoming", region: "West" },
];

export type GlwCityRegistryEntry = {
  stateCode: string;
  city: string;
  citySlug: string;
  enabled: boolean;
  metro?: string;
};

export const GLW_CITY_REGISTRY: GlwCityRegistryEntry[] = [
  { stateCode: "TX", city: "Austin", citySlug: "austin", enabled: true, metro: "Austin" },
  { stateCode: "TX", city: "Dallas", citySlug: "dallas", enabled: true, metro: "Dallas-Fort Worth" },
  { stateCode: "TX", city: "Houston", citySlug: "houston", enabled: true, metro: "Houston" },
  { stateCode: "TX", city: "San Antonio", citySlug: "san-antonio", enabled: true, metro: "San Antonio" },
  { stateCode: "CA", city: "Los Angeles", citySlug: "los-angeles", enabled: true, metro: "Los Angeles" },
  { stateCode: "CA", city: "San Diego", citySlug: "san-diego", enabled: true, metro: "San Diego" },
  { stateCode: "FL", city: "Miami", citySlug: "miami", enabled: true, metro: "Miami" },
  { stateCode: "FL", city: "Orlando", citySlug: "orlando", enabled: true, metro: "Orlando" },
  { stateCode: "IL", city: "Chicago", citySlug: "chicago", enabled: true, metro: "Chicago" },
  { stateCode: "GA", city: "Atlanta", citySlug: "atlanta", enabled: true, metro: "Atlanta" },
  { stateCode: "NC", city: "Charlotte", citySlug: "charlotte", enabled: true, metro: "Charlotte" },
  { stateCode: "NY", city: "New York", citySlug: "new-york", enabled: true, metro: "New York City" },
];

export function getGlwState(stateCode: string): GlwStateRegistryEntry | null {
  return GLW_STATE_REGISTRY.find((state) => state.code === stateCode) ?? null;
}

export function getGlwCity(citySlug: string): GlwCityRegistryEntry | null {
  return GLW_CITY_REGISTRY.find((city) => city.citySlug === citySlug) ?? null;
}

export function getGlwEnabledCities(): GlwCityRegistryEntry[] {
  return GLW_CITY_REGISTRY.filter((city) => city.enabled);
}

export function groupGlwCitiesByState(cities: GlwCityRegistryEntry[]): Record<string, GlwCityRegistryEntry[]> {
  return cities.reduce<Record<string, GlwCityRegistryEntry[]>>((groups, city) => {
    const bucket = groups[city.stateCode] ?? [];
    bucket.push(city);
    groups[city.stateCode] = bucket;
    return groups;
  }, {});
}