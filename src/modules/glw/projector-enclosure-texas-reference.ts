import "server-only";

import type { GlwCampaign } from "./campaign-types";
import type { GlwCampaignKnowledgePack } from "./campaign-reference-types";
import type { GlwLocalReferenceDraft } from "./campaign-local-reference-repository";

export const PROJECTOR_TEXAS_PARENT_CAMPAIGN_ID = "campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-california-expanded-cities";

export function selectDeterministicCityReference(campaign: GlwCampaign) {
  if (campaign.pageType !== "city_service" || !campaign.cityTargets?.length) throw new Error("City campaign targets are required.");
  return [...campaign.cityTargets].sort((left, right) =>
    `${left.stateCode}::${left.citySlug}`.localeCompare(`${right.stateCode}::${right.citySlug}`),
  )[0];
}

export function buildProjectorEnclosureTexasKnowledgePack(input: {
  campaign: GlwCampaign;
  parentPack: GlwCampaignKnowledgePack;
}): {
  instructions: string;
  authorityReferences: NonNullable<GlwCampaignKnowledgePack["authorityReferences"]>;
} {
  if (
    input.campaign.organizationId !== "ssi"
    || input.campaign.siteId !== "site-ssi-projectorenclosure"
    || input.campaign.productId !== "prod-ssi-fan-cooled-projector-enclosures"
    || input.campaign.parentCampaignId !== PROJECTOR_TEXAS_PARENT_CAMPAIGN_ID
  ) throw new Error("ProjectorEnclosure Texas campaign identity is required.");
  if (!input.parentPack.instructions.trim()) throw new Error("Parent campaign knowledge is required.");

  const instructions = `# Governed Campaign Instructions
## Fan Cooled Projector Enclosures - Texas Cities

### Authority and scope
Use only approved ProjectorEnclosure.com product authority and the stable, non-geographic guidance inherited from parent campaign ${PROJECTOR_TEXAS_PARENT_CAMPAIGN_ID}. The approved product facts are: built-in fan cooling; durable metal construction; removable or hinged access panels; intended positioning for indoor, covered outdoor, and mild-environment commercial AV installations. Treat the approved Los Angeles reference as quality evidence only, never as factual authority for Texas.

Generate city-service content only for the canonical Texas registry: Austin, Dallas, Houston, and San Antonio. The deterministic reference city is Austin. Use canonical hierarchy fan-cooled-projector-enclosures/texas/[city-slug]. Do not imply a Texas office, warehouse, installer, customer, project, inventory position, delivery commitment, or local facility.

### Product and application guidance
Describe fan-assisted airflow, physical protection, and service access using qualified language. Relevant applications may include classrooms, auditoriums, houses of worship, corporate presentation spaces, retail displays, golf simulators, projection mapping, and covered event spaces when contextually useful. Explain that suitability depends on projector dimensions, lens clearance, heat output, mounting, service access, temperature, humidity, sunlight, dust, and exposure.

Clearly distinguish fan-cooled enclosures from climate-controlled enclosures. Do not suggest fan cooling replaces active heating, cooling, or condensation control for exposed or harsh environments. Request projector make/model, lens, mounting method, available clearance, access direction, and environmental conditions before fit guidance.

### Texas localization
Use Texas and the selected city naturally in title, H1, introduction, one meaningful heading, planning guidance, metadata, and CTA. Localization must be neutral planning context, not an assertion about local climate, codes, customers, installations, or service presence. Do not reuse California geography, California weather, California regulations, California city names, or California-specific CTA language.

### SEO and internal links
Use one H1. Write for commercial buyers first. Avoid doorway-page repetition and unsupported superlatives. Approved links are:
- Fan-cooled overview: https://projectorenclosure.com/fan-cooled-projector-enclosures/
- Climate-controlled alternative: https://projectorenclosure.com/climate-controlled-projector-enclosures/
- Projector cages: https://projectorenclosure.com/projector-cages/
- Contact: https://projectorenclosure.com/contact-us-projection-enclosure/
Use only links relevant to visible copy. Canonical URL remains an operator-controlled field.

### Prohibited claims
Never invent customers, installations, testimonials, certifications, IP/NEMA/UL/ETL/CE ratings, dimensions, weight, airflow, noise, temperature range, waterproofing, compatibility, warranty, price, stock, shipping, lead time, Texas locations, local representatives, building-code compliance, or guaranteed performance. Do not expose governance language in customer-facing copy.

### Image guidance
A featured image is required for later canonical approval. The current governed candidate is the approved product asset wordpress-media:10757. Treat it as an owner asset candidate, not evidence of specifications or a Texas installation. Any generated alternative must be labeled GENERATED_VISUAL, use a neutral commercial AV setting, avoid landmarks/logos/competitor imagery, and remain unapproved until owner review.

### Review requirements
Keep the reference Genesis-local until the owner approves it for WordPress draft materialization. No local approval constitutes canonical campaign reference approval. No publication authority is provided. Validate title, SEO title, meta description, H1, sections, links, image status, provenance, and unsupported-claim boundaries before owner review.`;

  return {
    instructions,
    authorityReferences: [
      { sourceType: "parent_campaign", sourceId: PROJECTOR_TEXAS_PARENT_CAMPAIGN_ID, scope: "guidance" },
      { sourceType: "product", sourceId: "prod-ssi-fan-cooled-projector-enclosures", scope: "stable_fact" },
      { sourceType: "profile", sourceId: "profile-prompt-projectorenclosure-product", scope: "guidance" },
      { sourceType: "profile", sourceId: "profile-seo-projectorenclosure-default", scope: "guidance" },
      { sourceType: "profile", sourceId: "profile-image-projectorenclosure-product", scope: "guidance" },
      { sourceType: "profile", sourceId: "profile-workflow-projectorenclosure-site-studio", scope: "guidance" },
      { sourceType: "approved_reference", sourceId: "631fd533-9e71-4f0b-a82b-885da44fc767", scope: "quality_evidence" },
      { sourceType: "canonical_registry", sourceId: "GLW_CITIES:TX", scope: "geography" },
    ],
  };
}

export function buildProjectorEnclosureAustinReference(input: {
  campaign: GlwCampaign;
  knowledgePack: GlwCampaignKnowledgePack;
}): Omit<GlwLocalReferenceDraft, "referenceDraftId" | "revision" | "status" | "reviewInstructions" | "createdAt" | "updatedAt"> {
  const target = selectDeterministicCityReference(input.campaign);
  if (target.stateCode !== "TX" || target.citySlug !== "austin") throw new Error("Austin must be the deterministic Texas reference target.");
  const links = [
    { label: "fan-cooled projector enclosure options", url: "https://projectorenclosure.com/fan-cooled-projector-enclosures/" },
    { label: "climate-controlled projector enclosures", url: "https://projectorenclosure.com/climate-controlled-projector-enclosures/" },
    { label: "projector cages", url: "https://projectorenclosure.com/projector-cages/" },
    { label: "send project details", url: "https://projectorenclosure.com/contact-us-projection-enclosure/" },
  ];
  const sections = [
    { heading: "Plan projector protection for an Austin installation", bodyHtml: "<p>A fan-cooled projector enclosure can be considered for commercial AV projects in Austin when the installation is indoors, covered, or otherwise suited to fan-assisted airflow. The enclosure direction should be reviewed against the projector, lens, mounting arrangement, service access, heat output, and actual site conditions.</p>" },
    { heading: "What the enclosure is designed to provide", bodyHtml: "<p>Approved product information identifies built-in fan cooling, durable metal construction, and removable or hinged access panels. These features support airflow, physical protection, and service access without adding unsupported claims about dimensions, ratings, or compatibility.</p>" },
    { heading: "Where a fan-cooled enclosure may fit", bodyHtml: "<p>Potential settings include classrooms, auditoriums, houses of worship, corporate presentation rooms, retail displays, golf simulators, projection-mapping environments, and covered event spaces. Suitability depends on the specific projector and installation rather than the city name alone.</p>" },
    { heading: "Fan-cooled or climate-controlled?", bodyHtml: "<p>Fan-cooled protection may suit controlled indoor or covered environments with relatively stable conditions. A climate-controlled enclosure should be evaluated when equipment is exposed to rain, direct sun, extreme temperatures, high humidity, or condensation risk.</p>" },
    { heading: "Information needed for a fit review", bodyHtml: "<ul><li>Projector make and model</li><li>Lens model and clearance needs</li><li>Indoor, covered, or exposed location</li><li>Mounting method and available space</li><li>Required service-access direction</li><li>Heat, dust, humidity, sunlight, and operating concerns</li></ul>" },
    { heading: "Request enclosure guidance", bodyHtml: "<p>Send the Austin project location, projector and lens details, mounting approach, available clearances, and environmental conditions for a product-fit discussion. Recommendations remain subject to confirmation against the equipment and site.</p>" },
  ];
  return {
    campaignId: input.campaign.campaignId,
    organizationId: input.campaign.organizationId,
    siteId: input.campaign.siteId,
    productId: input.campaign.productId,
    stateCode: target.stateCode,
    citySlug: target.citySlug,
    cityName: target.cityName,
    canonicalPath: `fan-cooled-projector-enclosures/texas/${target.citySlug}`,
    title: "Fan Cooled Projector Enclosures in Austin, Texas",
    seoTitle: "Fan Cooled Projector Enclosures in Austin, TX",
    metaDescription: "Plan a fan-cooled projector enclosure for an Austin commercial AV installation. Compare site conditions and send projector details for fit guidance.",
    h1: "Fan Cooled Projector Enclosures in Austin, Texas",
    excerpt: "Guidance for evaluating fan-cooled projector protection for indoor, covered, and mild-environment commercial AV projects in Austin.",
    sections,
    internalLinks: links,
    image: {
      required: true,
      status: "OWNER_ASSET_CANDIDATE",
      assetReference: "wordpress-media:10757",
      classification: "OWNER_ASSET",
      altText: "Fan-cooled metal projector enclosure for a commercial AV installation",
      ownerApproved: false,
    },
    provenance: {
      parentCampaignId: PROJECTOR_TEXAS_PARENT_CAMPAIGN_ID,
      knowledgePackRevision: input.knowledgePack.revision ?? 1,
      authorityReferences: (input.knowledgePack.authorityReferences ?? []).map((reference) => `${reference.sourceType}:${reference.sourceId}`),
    },
  };
}
