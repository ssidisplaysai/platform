export const PROJECTORENCLOSURE_VINYL_WRAP_AUTHORITY = Object.freeze({
  authorityId: "owner-confirmed-ssi-projector-enclosure-vinyl-wrap-v1",
  productFamily: "SSI projector enclosures",
  sourceType: "OWNER_CONFIRMED_CAPABILITY",
  capability: "VINYL_WRAP_CUSTOMIZATION",
  statement: "SSI projector enclosures can be vinyl wrapped for installation-specific aesthetics.",
  aestheticIntents: ["BLEND_IN", "STAND_OUT", "CUSTOM_GRAPHIC"] as const,
  visualUse: "CONTEXTUAL_OR_GENERATED_REPRESENTATION",
  requiresAuthoritativeUnderlyingGeometry: true,
  prohibitedInferences: ["all models support every vinyl", "covering ventilation openings", "obstructing access panels", "weather resistance change", "thermal performance change", "security change", "warranty change", "certification change", "enclosure material change", "specific vinyl brand or material", "installation method", "lifespan", "environmental durability"] as const,
});