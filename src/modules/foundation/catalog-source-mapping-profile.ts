import type { CatalogMappingTarget } from "./catalog-import-preview";

export type CatalogSourceMappingProfile = {
  profileId: string;
  version: string;
  frozen: boolean;
  sourceName: string;
  columnMappings: Readonly<Record<string, CatalogMappingTarget>>;
  allowProductNameWithoutSku: boolean;
};

export const SSI_PRICING_MASTER_PROFILE: CatalogSourceMappingProfile = {
  profileId: "ssi-pricing-master-v1",
  version: "1.0.0",
  frozen: true,
  sourceName: "SSI Pricing Master Sheet.xlsx",
  allowProductNameWithoutSku: true,
  columnMappings: {
    "item name": "PRODUCT_NAME",
    sku: "SKU",
    status: "STATUS",
    "product description": "DESCRIPTION",
    photo: "MEDIA_REFERENCE",
    photos: "MEDIA_REFERENCE",
    "spec sheet link": "DOCUMENT_REFERENCE",
    notes: "SOURCE_METADATA",
    "additional info": "SOURCE_METADATA",
    "distributor price": "COMMERCIAL_PRICING_FIELD",
    "dealer price": "COMMERCIAL_PRICING_FIELD",
    "retail price": "COMMERCIAL_PRICING_FIELD",
    price: "COMMERCIAL_PRICING_FIELD",
    "all in one cost": "COMMERCIAL_PRICING_FIELD",
    "all in one price": "COMMERCIAL_PRICING_FIELD",
    "additional cost info": "COMMERCIAL_PRICING_FIELD",
    "additional optional cost info": "COMMERCIAL_PRICING_FIELD",
    "shipping cost": "LOGISTICS_FIELD",
    "warranty info shipping cost": "LOGISTICS_FIELD",
    "tariff duties import tax": "TAX_FIELD",
    "size option": "ATTRIBUTE",
    size: "ATTRIBUTE",
    "cabinet size": "ATTRIBUTE",
    module: "ATTRIBUTE",
    "touch option": "ATTRIBUTE",
    "add pcap touch": "ATTRIBUTE",
    brightness: "ATTRIBUTE",
    resolution: "ATTRIBUTE",
    "custom sizing": "ATTRIBUTE",
    "add mounting": "ATTRIBUTE",
    "add additional mounting": "ATTRIBUTE",
    "brighness refresh": "ATTRIBUTE",
  },
};

const SOURCE_PROFILES: Readonly<Record<string, CatalogSourceMappingProfile>> = {
  [SSI_PRICING_MASTER_PROFILE.profileId]: SSI_PRICING_MASTER_PROFILE,
};

export function getCatalogSourceMappingProfile(
  profileId: string | undefined,
): CatalogSourceMappingProfile | null {
  return profileId ? SOURCE_PROFILES[profileId] ?? null : null;
}