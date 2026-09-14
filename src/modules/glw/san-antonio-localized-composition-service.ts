import "server-only";

import { createHash } from "node:crypto";
import {
  APPLICATION_AUTHORITY_CONTRACT,
  deriveLocalThemeProfile,
  LOCAL_CONTEXT_CONTRACT,
  LOCALIZED_COMPOSITION_PLAN_CONTRACT,
  LOCAL_LINK_GRAPH_CONTRACT,
  validateApplicationAuthority,
  validateLocalizedMedia,
  validateLocalContext,
  validateLocalLinkGraph,
  type LocalResearchEvidence,
  type LocalizedMediaPlanItem,
  type SitePageApplicationAuthority,
  type SitePageLocalContext,
  type SitePageLocalLinkGraph,
} from "@/modules/foundation/local-context-page-theming";
import { getLocalPageThemingBundle, saveLocalPageThemingBundle, saveLocalPageThemingMedia, type LocalPageThemingBundle } from "@/modules/foundation/local-context-page-theming-repository";
import { getProductById } from "@/modules/foundation/product-repository";
import { resolveApprovedProductAuthorityMedia } from "@/modules/foundation/site-page-media-assignment";
import { getSiteById } from "@/modules/foundation/site-repository";
import { listGlwCampaigns } from "./campaign-repository";
import { listAllGlwCampaignTargets } from "./campaign-target-repository";
import { generateGenesisFeaturedImage } from "./generated-image-service";
import { glwPageExecutionRepository } from "./page-execution-repository";
import { generateGenesisFeaturedImageWithCampaignReferences } from "./reference-aware-image-service";

export const SAN_ANTONIO_LOCALIZED_JOB_ID = "f518ffb7-9216-4866-a93c-7f4793e74038";
export const SAN_ANTONIO_LOCALIZED_BUNDLE_ID = `local-theming-san-antonio-${SAN_ANTONIO_LOCALIZED_JOB_ID}-v1`;
export const SAN_ANTONIO_LOCALIZED_RENDERER_VERSION = "localized-rich-preview-v2.7";
const ARTIFACT_SHA256 = "0255fda847e2962dc0ae10afcd86a646a5d89aef303331286babf2dae49078d2";
const PRODUCT_ID = "prod-ssi-fan-cooled-projector-enclosures";
const PRODUCT_MEDIA_REFERENCE = "wordpress-media:10757";
const PRODUCT_MEDIA_SHA256 = "685495793be84b3a9d1a7e902087d63ae7a636e2042e6c0d592f5ba83e767078";
const AUTHORIZED_REMEDIATION_SHA = "c71fda6bb6cf635ec82730ed3f74422eaba39679";

const SOURCES = [
  ["product", "https://projectorenclosure.com/fan-cooled-projector-enclosures/", "Fan Cooled Projector Enclosures", "ProjectorEnclosure / Screen Solutions International", "OWNER_AUTHORITY", "The canonical product authority supports fan-cooled projector enclosures for indoor, covered outdoor, and mild-environment commercial AV, subject to exact projector and site-condition review."],
  ["outdoor", "https://projectorenclosure.com/ip65-projector-enclosures-for-outdoor-applications/", "IP65 Projector Enclosures for Outdoor Applications", "ProjectorEnclosure / Screen Solutions International", "OFFICIAL_BRAND", "The official outdoor resource distinguishes weather-rated protection from fan-cooled products intended for controlled or covered conditions."],
  ["contact", "https://projectorenclosure.com/contact-us-projection-enclosure/", "Project Review and Contact", "ProjectorEnclosure / Screen Solutions International", "OFFICIAL_BRAND", "The official contact path requests projector, lens, mounting, environment, and configuration details for product review."],
  ["climate", "https://www.weather.gov/ewx/climate", "Austin/San Antonio Local Climate Records", "National Weather Service Austin/San Antonio", "GOVERNMENT", "The official Austin/San Antonio Weather Forecast Office publishes San Antonio climate records, normals, rainfall, temperature, and hazard resources relevant to site-condition planning."],
  ["convention", "https://www.sahbgcc.com/", "Henry B. González Convention Center", "City of San Antonio", "OFFICIAL_VENUE", "The City-operated convention center documents ballrooms, exhibit halls, meeting spaces, theatre space, rigging, Wi-Fi, security, and AV services."],
  ["meetings", "https://www.visitsanantonio.com/meeting-professionals/", "San Antonio Meetings and Conventions", "Visit San Antonio", "OFFICIAL_INSTITUTION", "The official destination organization documents a large meetings, convention, hospitality, restaurant, and event infrastructure without establishing product demand or an SSI relationship."],
  ["public-art", "https://www.sa.gov/Directory/Departments/Arts/Public-Art", "San Antonio Public Art", "City of San Antonio Department of Arts & Culture", "GOVERNMENT", "The City documents public-art planning and cultural environments that may inform conceptual visual context without proving any SSI project or installation."],
] as const;

async function verifiedEvidence(fetcher: typeof fetch, createdAt: string): Promise<LocalResearchEvidence[]> {
  return Promise.all(SOURCES.map(async ([evidenceId, url, title, publisher, sourceClass, observedClaim]) => {
    const response = await fetcher(url, { method: "GET", redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`SAN_ANTONIO_RESEARCH_SOURCE_UNAVAILABLE:${evidenceId}:${response.status}`);
    return { evidenceId, url, title, publisher, sourceClass, retrievedAt: createdAt, verifiedAt: createdAt, httpStatus: response.status, observedClaim };
  }));
}

export async function createSanAntonioLocalizedComposition(input: { actor: string; fetcher?: typeof fetch; now?: string }): Promise<LocalPageThemingBundle> {
  const existing = getLocalPageThemingBundle({ organizationId: "ssi", siteId: "site-ssi-projectorenclosure", jobId: SAN_ANTONIO_LOCALIZED_JOB_ID, bundleId: SAN_ANTONIO_LOCALIZED_BUNDLE_ID });
  if (existing) return existing;
  if (!input.actor.trim()) throw new Error("SAN_ANTONIO_LOCALIZED_ACTOR_REQUIRED");
  const job = await glwPageExecutionRepository.getById(SAN_ANTONIO_LOCALIZED_JOB_ID);
  const target = listAllGlwCampaignTargets().find((item) => item.jobId === SAN_ANTONIO_LOCALIZED_JOB_ID);
  const campaign = target ? listGlwCampaigns().find((item) => item.campaignId === target.campaignId) : null;
  const product = getProductById(PRODUCT_ID);
  const site = getSiteById("site-ssi-projectorenclosure");
  const artifactHtml = job?.generatedDraft?.contentHtml ?? "";
  const artifactHash = createHash("sha256").update(artifactHtml, "utf8").digest("hex");
  if (!job || !target || !campaign || !product || !site || target.status !== "content_ready" || job.status !== "CONTENT_READY" || job.externalExecutionId !== "608895" || job.wordpressObjectId || target.wordpressObjectId || target.citySlug !== "san-antonio" || target.cityName !== "San Antonio" || target.stateCode !== "TX" || artifactHash !== ARTIFACT_SHA256 || campaign.publicationPolicy !== "draft_only") throw new Error("SAN_ANTONIO_LOCALIZED_IDENTITY_INVALID");
  if (product.media.primaryImageReference !== PRODUCT_MEDIA_REFERENCE || product.authorityProvenance?.authorityReference !== "wordpress-page:10541") throw new Error("SAN_ANTONIO_PRODUCT_AUTHORITY_STALE");
  const productAssignment = resolveApprovedProductAuthorityMedia({ organizationId: job.organizationId, siteId: job.siteId, productId: PRODUCT_ID, authorityReference: PRODUCT_MEDIA_REFERENCE });
  if (!productAssignment || productAssignment.asset.type !== "APPROVED_EXISTING" || productAssignment.asset.wordpressMediaId !== 10757 || productAssignment.asset.sha256 !== PRODUCT_MEDIA_SHA256) throw new Error("SAN_ANTONIO_PRODUCT_MEDIA_REQUIRED");
  const productResponse = await (input.fetcher ?? fetch)(productAssignment.asset.url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  const productBytes = new Uint8Array(await productResponse.arrayBuffer());
  if (!productResponse.ok || createHash("sha256").update(productBytes).digest("hex") !== PRODUCT_MEDIA_SHA256) throw new Error("SAN_ANTONIO_PRODUCT_MEDIA_STALE");
  const createdAt = input.now ?? new Date().toISOString();
  const evidence = await verifiedEvidence(input.fetcher ?? fetch, createdAt);
  const pageRevisionIdentity = `job:${job.jobId}:${job.updatedAt}`;
  const identity = { organizationId: job.organizationId, siteId: job.siteId, pageId: target.targetId, jobId: job.jobId, pageRevisionIdentity };
  const context: SitePageLocalContext = validateLocalContext({ contract: LOCAL_CONTEXT_CONTRACT, schemaVersion: 1, contextId: `local-context-san-antonio-${job.jobId}-r1`, identity, geography: { city: "San Antonio", state: "Texas", region: "South Central Texas", countryCode: "US" }, researchRevision: 1, evidence, facts: [
    { factId: "san-antonio-climate", kind: "CLIMATE_ENVIRONMENT", statement: "San Antonio site-condition planning should use official local temperature, rainfall, storm, and heat records and route exposed or harsh environments to the appropriate enclosure authority.", evidenceIds: ["climate", "product", "outdoor"] },
    { factId: "san-antonio-convention", kind: "VENUE_ENVIRONMENT", statement: "San Antonio's official convention infrastructure includes ballrooms, exhibit halls, meeting spaces, theatre space, rigging, Wi-Fi, security, and AV services, supporting convention and event application planning without establishing an SSI installation.", evidenceIds: ["convention", "meetings"] },
    { factId: "san-antonio-hospitality", kind: "MARKET_CHARACTERISTIC", statement: "Official destination evidence documents substantial meeting, hospitality, dining, and event infrastructure relevant to commercial AV planning, but it does not prove customer demand or product fit.", evidenceIds: ["meetings"] },
    { factId: "san-antonio-cultural", kind: "BUILT_ENVIRONMENT", statement: "City public-art authority and official convention facilities establish civic, cultural, theatre, meeting, and exhibit environments suitable for bounded application-context evaluation.", evidenceIds: ["public-art", "convention"] },
    { factId: "san-antonio-visual", kind: "VISUAL_CONTEXT", statement: "A Level 2 San Antonio expression may use shaded contemporary convention architecture, warm limestone-toned materials, metal and glass, planted courtyards, and South Central Texas daylight without depicting a recognizable property or landmark.", evidenceIds: ["convention", "meetings", "public-art", "climate"] },
  ], prohibitedInferences: ["SSI has a San Antonio office", "ProjectorEnclosure keeps local San Antonio inventory", "a depicted venue is an SSI customer", "a generated scene is an actual San Antonio installation", "SSI performed a depicted local project", "local response times or service guarantees"], createdAt }, pageRevisionIdentity);
  const source = Object.fromEntries(SOURCES.map((item) => [item[0], item[1]]));
  const linkSpecs = [
    ["product", source.product, "product", "INTERNAL_PRODUCT", "Review fan-cooled enclosure details", "Use canonical product truth and fit boundaries."],
    ["application", source.product, "product", "INTERNAL_APPLICATION", "Review commercial AV fit", "Connect application context to approved product authority."],
    ["outdoor", source.outdoor, "outdoor", "INTERNAL_CAPABILITY", "Compare outdoor protection requirements", "Route exposed environments to weather-rated authority."],
    ["support", source.contact, "contact", "INTERNAL_SUPPORT", "Request project-specific review", "Collect projector, lens, mounting, airflow, and environment details."],
    ["quote", source.contact, "contact", "INTERNAL_CONVERSION", "Discuss your San Antonio-area project", "Provide a governed conversion path without implying local presence."],
    ["nws", source.climate, "climate", "REGIONAL_REFERENCE", "Review official San Antonio climate records", "Ground environmental assumptions in official local data."],
    ["hbgcc", source.convention, "convention", "LOCAL_INSTITUTION", "Review San Antonio convention environments", "Document official meeting, exhibit, theatre, rigging, and AV contexts."],
    ["meetings-link", source.meetings, "meetings", "LOCAL_AUTHORITY", "Understand San Antonio meeting infrastructure", "Provide official convention and hospitality context."],
    ["public-art-link", source["public-art"], "public-art", "LOCAL_AUTHORITY", "Review San Antonio public-art context", "Provide official civic and cultural planning context."],
  ] as const;
  const links: SitePageLocalLinkGraph = validateLocalLinkGraph({ contract: LOCAL_LINK_GRAPH_CONTRACT, schemaVersion: 1, graphId: `local-links-san-antonio-${job.jobId}-r1`, identity, researchRevision: 1, links: linkSpecs.map(([linkId, url, evidenceId, role, anchorIntent, reason]) => ({ linkId, url, destinationIdentity: role.startsWith("INTERNAL") ? `url:${url}` : null, role, anchorIntent, reason, evidenceIds: [evidenceId], validation: { state: "VERIFIED", httpStatus: evidence.find((item) => item.evidenceId === evidenceId)!.httpStatus, checkedAt: createdAt } })), createdAt }, context);
  const applications: SitePageApplicationAuthority = validateApplicationAuthority({ contract: APPLICATION_AUTHORITY_CONTRACT, schemaVersion: 1, authorityId: `applications-san-antonio-${job.jobId}-r1`, identity, productId: PRODUCT_ID, researchRevision: 1, applications: [
    { applicationId: "COMMERCIAL_AV", label: "Commercial AV", compatibility: "SUPPORTED", relationship: "Approved fan-cooled product authority supports indoor, covered, and mild-environment commercial AV, while official San Antonio meeting and convention evidence establishes credible planning contexts.", evidenceIds: ["product", "convention", "meetings"], internalDestinationUrl: source.product },
    { applicationId: "EVENT_VENUE", label: "Convention and Event Venues", compatibility: "SUPPORTED", relationship: "Official venue evidence supports event, exhibit, meeting, theatre, rigging, and AV contexts where enclosure fit remains project-specific and exposure-bounded.", evidenceIds: ["product", "convention", "meetings"], internalDestinationUrl: source.product },
    { applicationId: "PROJECTION_MAPPING", label: "Projection Mapping", compatibility: "REVIEW_REQUIRED", relationship: "Product authority allows projection-mapping evaluation and City cultural context is relevant, but no specific local installation or venue fit is established.", evidenceIds: ["product", "public-art"], internalDestinationUrl: source.product },
    { applicationId: "OUTDOOR_PROJECTION", label: "Outdoor Projection", compatibility: "UNSUPPORTED", relationship: "Exposed conditions require weather-rated or climate-controlled authority rather than default fan-cooled selection.", evidenceIds: ["climate", "outdoor"], internalDestinationUrl: source.outdoor },
  ], createdAt }, context);
  const theme = deriveLocalThemeProfile({ profileId: `local-theme-san-antonio-${job.jobId}-r1`, context, applications, brandAuthorityReference: product.brandReference ?? "profile-brand-projectorenclosure-default", localizationLevel: 2, expression: { heroAtmosphere: "Contemporary covered San Antonio convention concourse in warm South Central Texas evening light, without a recognizable property or landmark.", environmentalCharacter: ["warm South Central Texas daylight", "shaded convention concourses", "civic and cultural scale", "landscaped courtyards"], materialCues: ["powder-coated metal", "glass", "limestone-toned masonry", "architectural concrete"], accentGuidance: "Preserve ProjectorEnclosure red, charcoal, white, and amber; local context changes atmosphere, never product or brand truth.", visualDensity: "Wide editorial bands, clear product scale, evidence-backed application context, controlled prose measure, and restrained planning cards.", terminology: ["San Antonio", "South Central Texas", "site conditions", "project review", "covered environment"], compositionEmphasis: ["approved enclosure", "credible covered in-use context", "convention and event application", "official regional planning resources"] }, antiClicheTerms: ["Alamo silhouette", "cowboy", "boots", "longhorn", "Texas flag", "western font", "desert", "ranch", "fiesta cliché", "red-white-blue theme"], createdAt });
  const prompts = {
    inUse: "Create a conceptual photorealistic covered commercial AV installation in a generic modern convention or corporate concourse with subtle San Antonio character: warm limestone-toned masonry, metal, glass, shaded exterior transition, and planted courtyard light. Use the approved projector-enclosure reference to show one physically plausible fan-cooled enclosure with realistic mounting, service clearance, airflow clearance, and lens alignment. The enclosure is the visible subject. No recognizable landmark or venue, customer, local office, inventory, people, logos, signage, readable text, flags, fiesta imagery, outdoor rain exposure, unsupported features, or documentary framing.",
    application: "Create a photorealistic application visualization of a flexible convention and event presentation environment in a generic contemporary San Antonio-inspired interior. Show large-scale projected visual content on an interior architectural surface with credible AV rigging and sightlines. Use warm limestone-toned materials, metal, glass, and restrained South Central Texas daylight without depicting a recognizable venue. No customer identity, logos, signage, readable text, crowd, local installation claim, or documentary framing.",
    atmosphere: "Create a restrained atmospheric commercial architecture image for a San Antonio AV planning page: a generic covered convention-district concourse at warm evening light with limestone-toned masonry, metal, glass, a shaded arcade, planted courtyard, broad South Central Texas sky, and generous negative space. No recognizable landmark, River Walk, Alamo, venue, people, projector, enclosure, logos, signs, flags, fiesta imagery, readable text, customer identity, or implication of an actual project.",
  };
  const [inUseResult, applicationResult, atmosphereResult] = await Promise.all([
    generateGenesisFeaturedImageWithCampaignReferences({ prompt: prompts.inUse, siteName: site.displayName, productTopic: product.displayName, campaignId: campaign.campaignId }),
    generateGenesisFeaturedImage({ prompt: prompts.application, siteName: site.displayName, productTopic: "commercial AV in covered convention and event environments" }),
    generateGenesisFeaturedImage({ prompt: prompts.atmosphere, siteName: site.displayName, productTopic: "San Antonio commercial AV planning atmosphere" }),
  ]);
  if (!inUseResult.ok || !applicationResult.ok || !atmosphereResult.ok) throw new Error(`SAN_ANTONIO_LOCALIZED_MEDIA_GENERATION_FAILED:${[inUseResult, applicationResult, atmosphereResult].filter((item) => !item.ok).map((item) => item.ok ? "" : item.state).join(",")}`);
  const generated = [
    { mediaId: "san-antonio-contextual-in-use-v1", role: "CONTEXTUAL_IN_USE", claimClass: "CONCEPTUAL_CONTEXTUAL", applicationId: "COMMERCIAL_AV", prompt: prompts.inUse, altText: "Concept visualization of a fan-cooled projector enclosure in a covered San Antonio-relevant commercial AV concourse", image: inUseResult.image },
    { mediaId: "san-antonio-event-experience-v1", role: "APPLICATION_EXPERIENCE", claimClass: "APPLICATION_VISUALIZATION", applicationId: "EVENT_VENUE", prompt: prompts.application, altText: "Application visualization of commercial projection in a San Antonio-inspired convention and event environment", image: applicationResult.image },
    { mediaId: "san-antonio-atmosphere-v1", role: "LOCAL_CONTEXTUAL_ATMOSPHERE", claimClass: "ATMOSPHERIC", applicationId: null, prompt: prompts.atmosphere, altText: "Atmospheric visualization of a covered San Antonio convention-district concourse at warm evening light", image: atmosphereResult.image },
  ] as const;
  const generatedMedia = generated.map((item): LocalizedMediaPlanItem => {
    const stored = saveLocalPageThemingMedia({ bundleId: SAN_ANTONIO_LOCALIZED_BUNDLE_ID, mediaId: item.mediaId, mimeType: item.image.mimeType, bytes: item.image.bytes });
    return validateLocalizedMedia({ mediaId: item.mediaId, role: item.role, claimClass: item.claimClass, source: "GENERATED_CANDIDATE", productTruthReference: item.role === "LOCAL_CONTEXTUAL_ATMOSPHERE" ? null : PRODUCT_MEDIA_REFERENCE, applicationId: item.applicationId, localContextId: context.contextId, generationPrompt: item.prompt, sha256: stored.sha256, url: `/api/glw/pages/${job.jobId}/localized-preview-v2/media/${item.mediaId}?organizationId=${job.organizationId}&siteId=${job.siteId}`, mimeType: item.image.mimeType, altText: item.altText, ownerReviewState: "PENDING" }, { context, applications });
  });
  const productMedia = validateLocalizedMedia({ mediaId: "san-antonio-product-authority-v1", role: "PRODUCT_AUTHORITY", claimClass: "DOCUMENTARY", source: "APPROVED_EXISTING", productTruthReference: PRODUCT_MEDIA_REFERENCE, applicationId: null, localContextId: null, generationPrompt: null, sha256: PRODUCT_MEDIA_SHA256, url: productAssignment.asset.url, mimeType: "image/webp", altText: productAssignment.metadata.altText, ownerReviewState: "APPROVED" }, { context, applications });
  const media = [productMedia, ...generatedMedia];
  const composition = { contract: LOCALIZED_COMPOSITION_PLAN_CONTRACT, schemaVersion: 2 as const, planId: `composition-plan-san-antonio-${job.jobId}-v1`, identity, priorPlanId: `composition-plan-${job.jobId}-${job.updatedAt}`, profile: "LOCATION_SERVICE" as const, localContextId: context.contextId, localLinkGraphId: links.graphId, applicationAuthorityId: applications.authorityId, localThemeProfileId: theme.profileId, mediaIds: media.map((item) => item.mediaId), validationState: "READY_FOR_OWNER_REVIEW" as const, blockers: [], wordpressMutationAuthorized: false as const, createdAt };
  return saveLocalPageThemingBundle({ bundleId: SAN_ANTONIO_LOCALIZED_BUNDLE_ID, context, links, applications, theme, media, composition, createdAt });
}

export const SAN_ANTONIO_LOCALIZED_AUTHORITY = { artifactSha256: ARTIFACT_SHA256, productMediaReference: PRODUCT_MEDIA_REFERENCE, productMediaSha256: PRODUCT_MEDIA_SHA256, authorizedRemediationSha: AUTHORIZED_REMEDIATION_SHA } as const;