import { registerGlwResearchSource } from "../src/modules/glw/research-source-registry";

const result = registerGlwResearchSource({
  sourceId: "research-source-allinprojectors-outdoor-projector-enclosures",
  url: "https://allinprojectors.com/outdoor-projector-enclosures/",
  domain: "allinprojectors.com",
  title: "The Ultimate Guide to 5 Best Outdoor Projector Enclosures",
  topic: "Outdoor projector enclosure buyer and application discovery",
  roles: ["COMPETITOR_RESEARCH", "MARKET_DISCOVERY"],
  classification: "DISCOVERY_ONLY",
  mayCreateProductFacts: false,
  accessStatus: "ACCESSIBLE",
  retrievedAt: "2026-09-05T22:48:00.000Z",
  discovery: {
    headings: ["Benefits", "Types", "Selection characteristics", "Installation", "Maintenance", "Projector comparisons", "Brands", "Event safety"],
    terminology: ["outdoor projector enclosure", "weather exposure", "ventilation and cooling", "service access", "fixed enclosure", "portable enclosure", "custom enclosure", "tamper resistance"],
    buyerQuestions: ["Which site conditions must be documented?", "How should airflow and service access be planned?", "Who owns mounting, electrical, and maintenance decisions?", "Which claims need written manufacturer confirmation?", "How does temporary-event planning differ from permanent installation?"],
    applications: ["residential outdoor viewing", "temporary events", "hospitality", "education and campuses", "commercial outdoor displays", "public venues"],
    selectionCriteria: ["projector identity", "environmental exposure", "cooling approach", "service access", "installation location", "operating schedule", "security concerns", "visual integration"],
    environmentalTopics: ["rain and humidity concerns", "dust and debris", "direct sunlight and heat", "airflow obstruction", "pests", "seasonal operation"],
    installationTopics: ["location assessment", "support responsibility", "power and cable routing", "airflow clearance", "commissioning", "inspection and maintenance access"],
    nicheAudiences: ["homeowners", "event organizers", "AV integrators", "facilities teams", "hospitality operators", "educational venues"],
    relatedTopicUrls: ["https://allinprojectors.com/outdoor-projector-screen/", "https://allinprojectors.com/top-ten-best-speakers-for-outdoor-projectors/", "https://allinprojectors.com/best-projector-ceiling-mount/"],
    contentOpportunities: ["outdoor enclosure planning checklist", "temporary versus permanent enclosure planning", "environmental question intake", "service-access planning", "projector enclosure commissioning checklist", "buyer questions before requesting a quote"],
    technicalClaimsRequiringCorroboration: ["weather protection performance", "temperature regulation", "image-quality effects", "lifespan extension", "material suitability", "mounting details", "filter and maintenance guidance"],
    competitorOnlyClaims: ["named enclosure brand capabilities", "named projector suitability", "security and tamper-resistance performance", "weatherproof classifications", "cooling-system performance"],
  },
});

console.log(JSON.stringify({
  sourceId: result.source.sourceId,
  created: result.created,
  classification: result.source.classification,
  roles: result.source.roles,
  mayCreateProductFacts: result.source.mayCreateProductFacts,
  accessStatus: result.source.accessStatus,
}, null, 2));