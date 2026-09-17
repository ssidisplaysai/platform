import "server-only";

import { createHash } from "node:crypto";
import type { SitePageMediaAssignment, SitePageMediaRole } from "@/modules/foundation/site-page-media-assignment";

export const GENERATED_CONTEXTUAL_MEDIA_AUTHORITY = "GENESIS_GENERATED_CONTEXTUAL_MEDIA_V1" as const;
export const CONTEXTUAL_MEDIA_PRODUCTION_ADAPTER_VERSION = "GENESIS_GLW_CONTEXTUAL_MEDIA_PRODUCTION_ADAPTER_V1" as const;

export type ContextualVisualSlot = "HERO_EXPERIENCE" | "POST_HERO_CONTEXTUAL" | "APPLICATION_STAGE" | "CTA_ATMOSPHERE";
export type ContextualMediaRole = Exclude<SitePageMediaRole, "PRODUCT_AUTHORITY">;
export type ContextualVisualPlanItem = {
  role: string;
  mediaRole: ContextualMediaRole;
  slot: ContextualVisualSlot;
  prompt: string;
  altText: string;
};

export type ContextualMediaIdentity = {
  organizationId: string;
  siteId: string;
  campaignId: string;
  targetId: string;
  productId: string;
  wordpressObjectId: string;
  pageRevisionId: string;
};

export type ContextualGenerationReceipt = {
  authority: typeof GENERATED_CONTEXTUAL_MEDIA_AUTHORITY;
  generationId: string;
  organizationId: string;
  siteId: string;
  campaignId: string;
  targetId: string;
  productId: string;
  wordpressObjectId: string;
  role: string;
  mediaRole: ContextualMediaRole;
  slot: ContextualVisualSlot;
  promptFingerprint: string;
  provider: string;
  model: string;
  outputDimensions: { width: number; height: number };
  generationCount: 1;
  selectedOutputCount: 1;
  latencyMs: number;
  reportedCost: number | "UNKNOWN";
  assetSha256: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  documentaryEvidence: false;
  actualInstallationEvidence: false;
  productSpecificationAuthority: false;
  customerEvidence: false;
  status: "SUCCEEDED";
  createdAt: string;
};

export type GeneratedContextualAsset = { receipt: ContextualGenerationReceipt; bytes: Buffer; wordpressMediaId: number | null; wordpressUrl: string | null };

export type ContextualMediaAdapterDependencies = {
  findSuccessfulGeneration(input: { identity: ContextualMediaIdentity; role: string; promptFingerprint: string }): GeneratedContextualAsset | null;
  generate(input: { identity: ContextualMediaIdentity; item: ContextualVisualPlanItem }): Promise<{ bytes: Buffer; mimeType: ContextualGenerationReceipt["mimeType"]; provider: string; model: string; width: number; height: number; reportedCost?: number | null }>;
  persistGeneration(input: { receipt: ContextualGenerationReceipt; bytes: Buffer }): GeneratedContextualAsset;
  persistAssignment(input: { identity: ContextualMediaIdentity; item: ContextualVisualPlanItem; asset: GeneratedContextualAsset; productAuthority: SitePageMediaAssignment; actor: string }): SitePageMediaAssignment;
  uploadMedia(input: { identity: ContextualMediaIdentity; item: ContextualVisualPlanItem; asset: GeneratedContextualAsset }): Promise<{ mediaId: number; url: string }>;
  patchPresentation(input: { identity: ContextualMediaIdentity; replacements: readonly { slot: ContextualVisualSlot; role: string; mediaRole: ContextualMediaRole; mediaId: number; url: string; assetSha256: string }[] }): Promise<{ storedSha256: string }>;
  certify(input: { identity: ContextualMediaIdentity; storedSha256: string }): Promise<{ certificationId: string; state: "PASS" }>;
};

const SLOT_SELECTORS: Record<ContextualVisualSlot, string> = {
  HERO_EXPERIENCE: "[data-reference-section=HERO] > img",
  POST_HERO_CONTEXTUAL: "[data-reference-section=PRODUCT_IDENTITY] img",
  APPLICATION_STAGE: "[data-reference-section=APPLICATIONS] .saw-application-stage img",
  CTA_ATMOSPHERE: "[data-reference-section=CTA]",
};

function required(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function fingerprint(prompt: string): string {
  return createHash("sha256").update(prompt.trim()).digest("hex");
}

function containsFalseEvidenceClaim(value: string): boolean {
  const assertions = value.replace(/\b(?:not|never)\s+(?:an?\s+)?(?:actual|completed|customer|client)\s+(?:installation|project)\b/gi, "");
  return /\b(?:actual|completed|customer|client)\s+(?:installation|project)\b/i.test(assertions);
}

export function validateContextualVisualPlan(plan: readonly ContextualVisualPlanItem[]): readonly ContextualVisualPlanItem[] {
  if (plan.length < 1 || plan.length > 5) throw new Error("CONTEXTUAL_MEDIA_PLAN_BOUNDS_INVALID");
  const roles = new Set<string>();
  const slots = new Set<ContextualVisualSlot>();
  for (const item of plan) {
    required(item.role, "CONTEXTUAL_MEDIA_PLAN_ROLE_REQUIRED");
    required(item.prompt, "CONTEXTUAL_MEDIA_PLAN_PROMPT_REQUIRED");
    required(item.altText, "CONTEXTUAL_MEDIA_PLAN_ALT_TEXT_REQUIRED");
    if ((item.mediaRole as SitePageMediaRole) === "PRODUCT_AUTHORITY") throw new Error("GENERATED_PRODUCT_AUTHORITY_MEDIA_FORBIDDEN");
    if (roles.has(item.role) || slots.has(item.slot)) throw new Error("CONTEXTUAL_MEDIA_PLAN_IDENTITY_DUPLICATE");
    if (containsFalseEvidenceClaim(`${item.prompt} ${item.altText}`)) throw new Error("GENERATED_CONTEXTUAL_MEDIA_FALSE_EVIDENCE_CLAIM");
    roles.add(item.role); slots.add(item.slot);
  }
  return structuredClone(plan);
}

export function contextualPresentationMutationScope(plan: readonly ContextualVisualPlanItem[]) {
  return validateContextualVisualPlan(plan).map((item) => ({ role: item.role, mediaRole: item.mediaRole, slot: item.slot, selector: SLOT_SELECTORS[item.slot], allowedPaths: ["contentHtml:media-reference", "mediaAssignment", "wordpressMedia"] as const }));
}

export async function runContextualMediaProductionAdapter(input: {
  mode: "DRY_RUN" | "EXECUTE";
  identity: ContextualMediaIdentity;
  visualPlan: readonly ContextualVisualPlanItem[];
  productAuthority: SitePageMediaAssignment;
  providerReady: boolean;
  actor: string;
  dependencies: ContextualMediaAdapterDependencies;
}) {
  for (const [value, code] of [[input.identity.organizationId, "ORGANIZATION"], [input.identity.siteId, "SITE"], [input.identity.campaignId, "CAMPAIGN"], [input.identity.targetId, "TARGET"], [input.identity.productId, "PRODUCT"], [input.identity.wordpressObjectId, "WORDPRESS_OBJECT"], [input.identity.pageRevisionId, "PAGE_REVISION"]] as const) required(value, `CONTEXTUAL_MEDIA_${code}_REQUIRED`);
  required(input.actor, "CONTEXTUAL_MEDIA_ACTOR_REQUIRED");
  if (!input.providerReady) throw new Error("CONTEXTUAL_MEDIA_PROVIDER_NOT_CONFIGURED");
  if (input.productAuthority.role !== "PRODUCT_AUTHORITY" || input.productAuthority.asset.type !== "APPROVED_EXISTING" || input.productAuthority.asset.productId !== input.identity.productId) throw new Error("CONTEXTUAL_MEDIA_PRODUCT_AUTHORITY_REQUIRED");
  const plan = validateContextualVisualPlan(input.visualPlan);
  const mutationScope = contextualPresentationMutationScope(plan);
  const base = { version: CONTEXTUAL_MEDIA_PRODUCTION_ADAPTER_VERSION, authority: GENERATED_CONTEXTUAL_MEDIA_AUTHORITY, identity: structuredClone(input.identity), visualPlan: plan, mutationScope, productAuthorityProtected: true as const, certificationDownstreamOfMutation: true as const };
  if (input.mode === "DRY_RUN") return { ...base, state: "DRY_RUN_READY" as const, assets: [], certification: null, accounting: { imageGenerationRequests: 0, imageGenerationOutputs: 0, wordpressUploads: 0, wordpressMutations: 0, certificationRuns: 0, publications: 0, n8nExecutions: 0, contentGenerationJobs: 0, contentGenerationAttempts: 0, contentModelCalls: 0, nextStateDispatches: 0 } };

  const assets: GeneratedContextualAsset[] = [];
  let requests = 0;
  for (const item of plan) {
    const promptFingerprint = fingerprint(item.prompt);
    let asset = input.dependencies.findSuccessfulGeneration({ identity: input.identity, role: item.role, promptFingerprint });
    if (!asset) {
      const started = Date.now();
      const generated = await input.dependencies.generate({ identity: input.identity, item }); requests += 1;
      const receipt: ContextualGenerationReceipt = { authority: GENERATED_CONTEXTUAL_MEDIA_AUTHORITY, generationId: `contextual-generation-${createHash("sha256").update(JSON.stringify({ siteId: input.identity.siteId, productId: input.identity.productId, targetId: input.identity.targetId, role: item.role, promptFingerprint })).digest("hex")}`, ...structuredClone(input.identity), role: item.role, mediaRole: item.mediaRole, slot: item.slot, promptFingerprint, provider: required(generated.provider, "GENERATED_MEDIA_PROVIDER_REQUIRED"), model: required(generated.model, "GENERATED_MEDIA_MODEL_REQUIRED"), outputDimensions: { width: generated.width, height: generated.height }, generationCount: 1, selectedOutputCount: 1, latencyMs: Math.max(0, Date.now() - started), reportedCost: typeof generated.reportedCost === "number" ? generated.reportedCost : "UNKNOWN", assetSha256: createHash("sha256").update(generated.bytes).digest("hex"), mimeType: generated.mimeType, documentaryEvidence: false, actualInstallationEvidence: false, productSpecificationAuthority: false, customerEvidence: false, status: "SUCCEEDED", createdAt: new Date().toISOString() };
      asset = input.dependencies.persistGeneration({ receipt, bytes: generated.bytes });
    }
    input.dependencies.persistAssignment({ identity: input.identity, item, asset, productAuthority: input.productAuthority, actor: input.actor });
    assets.push(asset);
  }
  const replacements = [];
  for (let index = 0; index < plan.length; index += 1) {
    const uploaded = await input.dependencies.uploadMedia({ identity: input.identity, item: plan[index], asset: assets[index] });
    replacements.push({ slot: plan[index].slot, role: plan[index].role, mediaRole: plan[index].mediaRole, mediaId: uploaded.mediaId, url: uploaded.url, assetSha256: assets[index].receipt.assetSha256 });
  }
  const patched = await input.dependencies.patchPresentation({ identity: input.identity, replacements });
  const certification = await input.dependencies.certify({ identity: input.identity, storedSha256: patched.storedSha256 });
  if (certification.state !== "PASS") throw new Error("CONTEXTUAL_MEDIA_CERTIFICATION_FAILED");
  return { ...base, state: "OWNER_REVIEW_READY" as const, assets, storedSha256: patched.storedSha256, certification, accounting: { imageGenerationRequests: requests, imageGenerationOutputs: requests, wordpressUploads: replacements.length, wordpressMutations: 1, certificationRuns: 1, publications: 0, n8nExecutions: 0, contentGenerationJobs: 0, contentGenerationAttempts: 0, contentModelCalls: 0, nextStateDispatches: 0 } };
}