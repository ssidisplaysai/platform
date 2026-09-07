import type { ProductSpecification } from "./types";

export const LDW_INDOOR_DIGITAL_SPHERE_PRODUCT_BROWSER_AUTHORITY = {
  sourceClass: "VERIFIED_FIRST_PARTY_PRODUCT_AUTHORITY",
  sourceUrl: "https://ssidisplays.com/product-browser/",
  categoryId: 8,
  categoryName: "Indoor Digital Spheres",
  recordCount: 38,
  capturedAt: "2026-09-07T23:29:26.779Z",
} as const;

type ProductBrowserModel = {
  recordId: number;
  physicalSize: string;
  pixelPitch: string;
  resolution: string;
};

export const LDW_INDOOR_DIGITAL_SPHERE_MODELS: readonly ProductBrowserModel[] = Object.freeze([
  { recordId: 163, physicalSize: "19.7 ft (6.0 m)", pixelPitch: "P2", resolution: "9425 × 4712" },
  { recordId: 171, physicalSize: "19.7 ft (6.0 m)", pixelPitch: "P2.5", resolution: "7540 × 3770" },
  { recordId: 134, physicalSize: '20" (0.5 m)', pixelPitch: "P1.25", resolution: "1256 × 628" },
  { recordId: 141, physicalSize: '20" (0.5 m)', pixelPitch: "P1.5", resolution: "1047 × 526" },
  { recordId: 148, physicalSize: '20" (0.5 m)', pixelPitch: "P1.8", resolution: "872 × 436" },
  { recordId: 164, physicalSize: '20" (0.5 m)', pixelPitch: "P2.5", resolution: "628 × 314" },
  { recordId: 155, physicalSize: '24" (0.6 m)', pixelPitch: "P2", resolution: "942 × 471" },
  { recordId: 135, physicalSize: '31" (0.8 m)', pixelPitch: "P1.25", resolution: "2010 × 1005" },
  { recordId: 142, physicalSize: '31" (0.8 m)', pixelPitch: "P1.5", resolution: "1675 × 837" },
  { recordId: 156, physicalSize: '31" (0.8 m)', pixelPitch: "P2", resolution: "1256 × 628" },
  { recordId: 136, physicalSize: '39" (1.0 m)', pixelPitch: "P1.25", resolution: "2513 × 1256" },
  { recordId: 143, physicalSize: '39" (1.0 m)', pixelPitch: "P1.5", resolution: "2094 × 1047" },
  { recordId: 149, physicalSize: '39" (1.0 m)', pixelPitch: "P1.8", resolution: "1745 × 872" },
  { recordId: 157, physicalSize: '39" (1.0 m)', pixelPitch: "P2", resolution: "1571 × 785" },
  { recordId: 165, physicalSize: '39" (1.0 m)', pixelPitch: "P2.5", resolution: "1257 × 628" },
  { recordId: 138, physicalSize: "4.9 ft (1.5 m)", pixelPitch: "P1.25", resolution: "3770 × 1887" },
  { recordId: 145, physicalSize: "4.9 ft (1.5 m)", pixelPitch: "P1.5", resolution: "3141 × 1570" },
  { recordId: 151, physicalSize: "4.9 ft (1.5 m)", pixelPitch: "P1.8", resolution: "2618 × 1309" },
  { recordId: 159, physicalSize: "4.9 ft (1.5 m)", pixelPitch: "P2", resolution: "2356 × 1178" },
  { recordId: 167, physicalSize: "4.9 ft (1.5 m)", pixelPitch: "P2.5", resolution: "1885 × 942" },
  { recordId: 137, physicalSize: '47" (1.2 m)', pixelPitch: "P1.25", resolution: "3016 × 1508" },
  { recordId: 144, physicalSize: '47" (1.2 m)', pixelPitch: "P1.5", resolution: "2513 × 1256" },
  { recordId: 150, physicalSize: '47" (1.2 m)', pixelPitch: "P1.8", resolution: "2094 × 1047" },
  { recordId: 158, physicalSize: '47" (1.2 m)', pixelPitch: "P2", resolution: "1885 × 942" },
  { recordId: 166, physicalSize: '47" (1.2 m)', pixelPitch: "P2.5", resolution: "1508 × 754" },
  { recordId: 139, physicalSize: "5.9 ft (1.8 m)", pixelPitch: "P1.25", resolution: "4524 × 2262" },
  { recordId: 146, physicalSize: "5.9 ft (1.8 m)", pixelPitch: "P1.5", resolution: "3770 × 1885" },
  { recordId: 152, physicalSize: "5.9 ft (1.8 m)", pixelPitch: "P1.8", resolution: "3142 × 1571" },
  { recordId: 160, physicalSize: "5.9 ft (1.8 m)", pixelPitch: "P2", resolution: "2827 × 1414" },
  { recordId: 168, physicalSize: "5.9 ft (1.8 m)", pixelPitch: "P2.5", resolution: "2262 × 1131" },
  { recordId: 140, physicalSize: "6.6 ft (2.0 m)", pixelPitch: "P1.25", resolution: "5026 × 2513" },
  { recordId: 147, physicalSize: "6.6 ft (2.0 m)", pixelPitch: "P1.5", resolution: "4188 × 2094" },
  { recordId: 153, physicalSize: "6.6 ft (2.0 m)", pixelPitch: "P1.8", resolution: "3491 × 1745" },
  { recordId: 161, physicalSize: "6.6 ft (2.0 m)", pixelPitch: "P2", resolution: "3142 × 1571" },
  { recordId: 169, physicalSize: "6.6 ft (2.0 m)", pixelPitch: "P2.5", resolution: "2513 × 1257" },
  { recordId: 154, physicalSize: "9.8 ft (3.0 m)", pixelPitch: "P1.8", resolution: "5236 × 2618" },
  { recordId: 162, physicalSize: "9.8 ft (3.0 m)", pixelPitch: "P2", resolution: "4712 × 2356" },
  { recordId: 170, physicalSize: "9.8 ft (3.0 m)", pixelPitch: "P2.5", resolution: "3770 × 1885" },
]);

export function buildLdwIndoorDigitalSphereSpecifications(): readonly ProductSpecification[] {
  return LDW_INDOOR_DIGITAL_SPHERE_MODELS.flatMap((model, index) => {
    const sourceReference = `ssi-product-browser:category:8:record:${model.recordId}`;
    const group = `Product Browser model ${model.recordId}`;
    const common = {
      specificationGroup: group,
      sourceReference,
      evidenceReference: LDW_INDOOR_DIGITAL_SPHERE_PRODUCT_BROWSER_AUTHORITY.sourceUrl,
      confidence: 1,
      visibility: "public" as const,
    };
    return [
      { specificationId: `spec-ldw-sphere-${model.recordId}-size`, key: `model_${model.recordId}_physical_size`, displayLabel: "Physical Size", rawValue: model.physicalSize, normalizedValue: null, unit: null, sortOrder: index * 3 + 1, ...common },
      { specificationId: `spec-ldw-sphere-${model.recordId}-pitch`, key: `model_${model.recordId}_pixel_pitch`, displayLabel: "Pixel Pitch", rawValue: model.pixelPitch, normalizedValue: null, unit: null, sortOrder: index * 3 + 2, ...common },
      { specificationId: `spec-ldw-sphere-${model.recordId}-resolution`, key: `model_${model.recordId}_resolution`, displayLabel: "Resolution", rawValue: model.resolution, normalizedValue: null, unit: null, sortOrder: index * 3 + 3, ...common },
    ];
  });
}