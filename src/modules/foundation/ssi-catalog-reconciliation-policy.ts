import type { AttributeDefinition } from "./canonical-catalog";

export type SsiHeaderDecision = {
  sheetName: string;
  headerRow: number;
  observedConfidence: "EXACT" | "HIGH" | "MEDIUM";
  decision: "APPROVED";
  reason: string;
};

export type SsiFamilyPolicy = {
  familyId: string;
  familyName: string;
  productIdentityFields: readonly string[];
  variantIdentityFields: readonly string[];
  nonIdentityFields: readonly string[];
};

export type SsiSheetFamilyDecision = {
  sheetName: string;
  familyId: string;
  familyName: string;
  reason: string;
};

export type SsiCatalogReconciliationPolicy = {
  policyId: string;
  version: string;
  sourceProfileId: string;
  sourceProfileVersion: string;
  frozen: true;
  headerDecisions: readonly SsiHeaderDecision[];
  sheetFamilyDecisions: readonly SsiSheetFamilyDecision[];
  familyPolicies: readonly SsiFamilyPolicy[];
  attributeDefinitions: readonly AttributeDefinition[];
};

const HEADER_ROW_2: Readonly<Record<string, "EXACT" | "HIGH">> = {
  "Indoor Kiosks": "EXACT",
  "Outdoor Kiosks": "EXACT",
  "Indoor Digital Spheres": "HIGH",
  "Outdoor Digital Spheres": "EXACT",
  OLED: "EXACT",
  "Standard DVLED": "HIGH",
  "LED Posters": "HIGH",
  "LED Fans": "HIGH",
  "Highbright Displays": "HIGH",
  "Projector Enclosures": "HIGH",
  "Touch Monitors": "EXACT",
  "E-Paper Display Tablets": "EXACT",
};

const HEADER_ROW_1: Readonly<Record<string, "HIGH" | "MEDIUM">> = {
  "Interactive Projection Sphere S": "HIGH",
  "Projection Hemispheres": "HIGH",
  "Fixed Combo Projection Sphere S": "HIGH",
  "Projection Dome Screens": "HIGH",
  "Round LED": "HIGH",
  "LED Cubes": "HIGH",
  "Transparent LED": "MEDIUM",
  "Tileable Roll-Up LED": "MEDIUM",
  "Can LED Screen": "MEDIUM",
  "Reception Desk LED": "MEDIUM",
  "Exhibition Table LED": "MEDIUM",
  "Interactive LED Floor": "MEDIUM",
  "SMD All-in-One LED": "MEDIUM",
  "COB All-in-One LED": "MEDIUM",
  "Automated Lift & Foldable LED A": "MEDIUM",
};

export const SSI_HEADER_DECISIONS: readonly SsiHeaderDecision[] = [
  ...Object.entries(HEADER_ROW_2).map(([sheetName, observedConfidence]) => ({
    sheetName,
    headerRow: 2,
    observedConfidence,
    decision: "APPROVED" as const,
    reason: "Row 1 is family narrative and row 2 contains the repeated tabular field vocabulary.",
  })),
  ...Object.entries(HEADER_ROW_1).map(([sheetName, observedConfidence]) => ({
    sheetName,
    headerRow: 1,
    observedConfidence,
    decision: "APPROVED" as const,
    reason: "Row 1 is the populated tabular header followed by product or pricing-grid rows.",
  })),
].sort((left, right) => left.sheetName.localeCompare(right.sheetName));

const sheetFamily = (
  sheetName: string,
  familyId: string,
  familyName: string,
  reason: string,
): SsiSheetFamilyDecision => ({ sheetName, familyId, familyName, reason });

export const SSI_SHEET_FAMILY_DECISIONS: readonly SsiSheetFamilyDecision[] = [
  sheetFamily("Indoor Kiosks", "family-kiosks", "Digital Kiosks", "Indoor and outdoor kiosk sheets share form-factor semantics; environment remains a product attribute."),
  sheetFamily("Outdoor Kiosks", "family-kiosks", "Digital Kiosks", "Indoor and outdoor kiosk sheets share form-factor semantics; environment remains a product attribute."),
  sheetFamily("Indoor Digital Spheres", "family-digital-spheres", "Digital Spheres", "Indoor and outdoor sphere sheets share sphere identity; environment remains explicit."),
  sheetFamily("Outdoor Digital Spheres", "family-digital-spheres", "Digital Spheres", "Indoor and outdoor sphere sheets share sphere identity; environment remains explicit."),
  sheetFamily("Interactive Projection Sphere S", "family-interactive-projection-spheres", "Interactive Projection Spheres", "Interactive projection configuration is a distinct family."),
  sheetFamily("Projection Hemispheres", "family-projection-hemispheres", "Projection Hemispheres", "Hemisphere geometry is product-defining."),
  sheetFamily("Fixed Combo Projection Sphere S", "family-combo-projection-spheres", "Combo Projection Spheres", "Fixed-combo configuration is product-defining."),
  sheetFamily("Projection Dome Screens", "family-projection-dome-screens", "Projection Dome Screens", "Dome geometry is product-defining."),
  sheetFamily("OLED", "family-oled", "OLED Displays", "OLED is the reviewed display family."),
  sheetFamily("Standard DVLED", "family-standard-dvled", "Standard DVLED", "Standard direct-view LED is the reviewed modular video-wall family."),
  sheetFamily("LED Posters", "family-led-posters", "LED Posters", "Poster form factor is product-defining."),
  sheetFamily("Round LED", "family-round-led", "Round LED", "Round geometry is product-defining."),
  sheetFamily("LED Cubes", "family-led-cubes", "LED Cubes", "Cube geometry is product-defining."),
  sheetFamily("Transparent LED", "family-transparent-led", "Transparent LED", "Transparent LED construction is product-defining."),
  sheetFamily("Tileable Roll-Up LED", "family-roll-up-led", "Tileable Roll-Up LED", "Roll-up construction is product-defining."),
  sheetFamily("Can LED Screen", "family-can-led", "Can LED Screens", "Can/cylindrical construction is product-defining."),
  sheetFamily("Reception Desk LED", "family-reception-desk-led", "Reception Desk LED", "Reception-desk integration is product-defining."),
  sheetFamily("Exhibition Table LED", "family-exhibition-table-led", "Exhibition Table LED", "Exhibition-table integration is product-defining."),
  sheetFamily("Interactive LED Floor", "family-interactive-led-floor", "Interactive LED Floors", "Interactive floor construction is product-defining."),
  sheetFamily("SMD All-in-One LED", "family-all-in-one-led", "All-in-One LED", "SMD and COB sheets share all-in-one form; LED technology is identity-bearing."),
  sheetFamily("COB All-in-One LED", "family-all-in-one-led", "All-in-One LED", "SMD and COB sheets share all-in-one form; LED technology is identity-bearing."),
  sheetFamily("Automated Lift & Foldable LED A", "family-lift-foldable-led", "Automated Lift and Foldable LED", "Lift/fold mechanism is product-defining."),
  sheetFamily("LED Fans", "family-led-fans", "LED Fans", "Rotating fan display technology is product-defining."),
  sheetFamily("Highbright Displays", "family-highbright-displays", "Highbright Displays", "High-brightness commercial LCD is product-defining."),
  sheetFamily("Projector Enclosures", "family-projector-enclosures", "Projector Enclosures", "Protective enclosure form is product-defining."),
  sheetFamily("Touch Monitors", "family-touch-monitors", "Touch Monitors", "Interactive monitor form is product-defining."),
  sheetFamily("E-Paper Display Tablets", "family-e-paper-displays", "E-Paper Displays", "E-paper technology is product-defining."),
];

const familyPolicy = (
  familyId: string,
  familyName: string,
  variantIdentityFields: readonly string[],
): SsiFamilyPolicy => ({
  familyId,
  familyName,
  productIdentityFields: ["PRODUCT_NAME", "SHEET_FAMILY"],
  variantIdentityFields,
  nonIdentityFields: [
    "DESCRIPTION",
    "STATUS",
    "brightness",
    "add-mounting",
    "add-additional-mounting",
  ].filter((field) => !variantIdentityFields.includes(field)),
});

export const SSI_FAMILY_POLICIES: readonly SsiFamilyPolicy[] = [
  familyPolicy("family-kiosks", "Digital Kiosks", ["SKU", "size-option", "touch-option", "add-pcap-touch"]),
  familyPolicy("family-digital-spheres", "Digital Spheres", ["SKU", "size", "size-option", "resolution"]),
  familyPolicy("family-interactive-projection-spheres", "Interactive Projection Spheres", ["size-option"]),
  familyPolicy("family-projection-hemispheres", "Projection Hemispheres", ["size-option"]),
  familyPolicy("family-combo-projection-spheres", "Combo Projection Spheres", ["size-option"]),
  familyPolicy("family-projection-dome-screens", "Projection Dome Screens", ["size-option"]),
  familyPolicy("family-oled", "OLED Displays", ["SKU", "size-option", "touch-option"]),
  familyPolicy("family-standard-dvled", "Standard DVLED", ["SKU", "size-option", "cabinet-size", "module", "resolution", "brighness-refresh"]),
  familyPolicy("family-led-posters", "LED Posters", ["SKU", "size-option"]),
  familyPolicy("family-round-led", "Round LED", ["size-option", "resolution"]),
  familyPolicy("family-led-cubes", "LED Cubes", ["size-option", "resolution"]),
  familyPolicy("family-transparent-led", "Transparent LED", ["size-option", "size", "cabinet-size", "module", "resolution"]),
  familyPolicy("family-roll-up-led", "Tileable Roll-Up LED", ["size-option", "size", "module", "resolution"]),
  familyPolicy("family-can-led", "Can LED Screens", ["size-option", "size", "resolution"]),
  familyPolicy("family-reception-desk-led", "Reception Desk LED", ["size-option", "size", "resolution"]),
  familyPolicy("family-exhibition-table-led", "Exhibition Table LED", ["size-option", "size", "resolution"]),
  familyPolicy("family-interactive-led-floor", "Interactive LED Floors", ["size-option", "module", "resolution", "brightness"]),
  familyPolicy("family-all-in-one-led", "All-in-One LED", ["SHEET_NAME", "size-option", "cabinet-size", "resolution", "touch-option"]),
  familyPolicy("family-lift-foldable-led", "Automated Lift and Foldable LED", ["size-option", "resolution"]),
  familyPolicy("family-led-fans", "LED Fans", ["SKU", "size-option"]),
  familyPolicy("family-highbright-displays", "Highbright Displays", ["SKU", "size-option", "brightness", "touch-option"]),
  familyPolicy("family-projector-enclosures", "Projector Enclosures", ["SKU", "size-option", "custom-sizing"]),
  familyPolicy("family-touch-monitors", "Touch Monitors", ["SKU", "size-option", "touch-option", "add-pcap-touch"]),
  familyPolicy("family-e-paper-displays", "E-Paper Displays", ["SKU", "size-option"]),
];

const attribute = (
  attributeDefinitionId: string,
  key: string,
  label: string,
  dataType: AttributeDefinition["dataType"],
  unitDimension: string | null = null,
  allowedUnits: readonly string[] = [],
): AttributeDefinition => ({
  attributeDefinitionId,
  key,
  label,
  dataType,
  unitDimension,
  allowedUnits,
  cardinality: "SINGLE",
  identityBearing: false,
  requiredForVariant: false,
  visibility: "PUBLIC",
  normalizationPolicy: { trim: true, caseNormalization: "NONE", canonicalUnit: allowedUnits[0] ?? null },
  version: 1,
});

export const SSI_ATTRIBUTE_DEFINITIONS: readonly AttributeDefinition[] = [
  attribute("attribute-size-option", "size-option", "Size / Option", "STRING"),
  attribute("attribute-size", "size", "Size", "DIMENSION", "length", ["mm", "in", "ft"]),
  attribute("attribute-cabinet-size", "cabinet-size", "Cabinet Size", "DIMENSION", "length", ["mm"]),
  attribute("attribute-module", "module", "Module", "STRING"),
  attribute("attribute-touch-option", "touch-option", "Touch Option", "ENUM"),
  attribute("attribute-add-pcap-touch", "add-pcap-touch", "PCAP Touch Option", "BOOLEAN"),
  attribute("attribute-brightness", "brightness", "Brightness", "NUMBER", "luminance", ["nits"]),
  attribute("attribute-brightness-refresh", "brightness-refresh", "Brightness / Refresh Rate", "STRING"),
  attribute("attribute-resolution", "resolution", "Resolution", "STRING"),
  attribute("attribute-custom-sizing", "custom-sizing", "Custom Sizing", "BOOLEAN"),
  attribute("attribute-add-mounting", "add-mounting", "Mounting Option", "STRING"),
  attribute("attribute-add-additional-mounting", "add-additional-mounting", "Additional Mounting", "STRING"),
];

export const SSI_CATALOG_RECONCILIATION_POLICY: SsiCatalogReconciliationPolicy = {
  policyId: "ssi-catalog-reconciliation-v1",
  version: "1.1.0",
  sourceProfileId: "ssi-pricing-master-v1",
  sourceProfileVersion: "1.0.0",
  frozen: true,
  headerDecisions: SSI_HEADER_DECISIONS,
  sheetFamilyDecisions: SSI_SHEET_FAMILY_DECISIONS,
  familyPolicies: SSI_FAMILY_POLICIES,
  attributeDefinitions: SSI_ATTRIBUTE_DEFINITIONS,
};