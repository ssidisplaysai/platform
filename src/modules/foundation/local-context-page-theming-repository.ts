import "server-only";

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deepClone, loadPersistedState, resolvePersistenceRoot, savePersistedState } from "./foundation-persistence";
import { LOCALIZED_COMPOSITION_PLAN_CONTRACT, validateApplicationAuthority, validateLocalContext, validateLocalLinkGraph, validateLocalizedMedia, validateLocalThemeProfile, type LocalizedCompositionPlanV2, type LocalizedMediaPlanItem, type SitePageApplicationAuthority, type SitePageLocalContext, type SitePageLocalLinkGraph, type SitePageLocalThemeProfile } from "./local-context-page-theming";

const NAMESPACE = "site-page-local-theming-v1";
const MEDIA_DIRECTORY = "site-page-local-theming-media";
export type LocalPageThemingBundle = { bundleId: string; context: SitePageLocalContext; links: SitePageLocalLinkGraph; applications: SitePageApplicationAuthority; theme: SitePageLocalThemeProfile; media: readonly LocalizedMediaPlanItem[]; composition: LocalizedCompositionPlanV2; createdAt: string };
type State = { bundles: LocalPageThemingBundle[] };
const load = () => loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: () => ({ bundles: [] }) });
const sameIdentity = (left: SitePageLocalContext["identity"], right: SitePageLocalContext["identity"]) => JSON.stringify(left) === JSON.stringify(right);

export function saveLocalPageThemingBundle(bundle: LocalPageThemingBundle): LocalPageThemingBundle {
  const context = validateLocalContext(bundle.context, bundle.composition.identity.pageRevisionIdentity);
  validateLocalLinkGraph(bundle.links, context); validateApplicationAuthority(bundle.applications, context);
  validateLocalThemeProfile(bundle.theme, { context, applications: bundle.applications });
  if (bundle.composition.contract !== LOCALIZED_COMPOSITION_PLAN_CONTRACT || bundle.composition.schemaVersion !== 2 || !sameIdentity(bundle.composition.identity, context.identity) || bundle.composition.localContextId !== context.contextId || bundle.composition.localLinkGraphId !== bundle.links.graphId || bundle.composition.applicationAuthorityId !== bundle.applications.authorityId || bundle.composition.localThemeProfileId !== bundle.theme.profileId || bundle.composition.wordpressMutationAuthorized !== false) throw new Error("LOCALIZED_COMPOSITION_PLAN_INVALID");
  const mediaIds = new Set(bundle.media.map((item) => validateLocalizedMedia(item, { context, applications: bundle.applications }).mediaId));
  if (bundle.composition.mediaIds.some((id) => !mediaIds.has(id))) throw new Error("LOCALIZED_COMPOSITION_MEDIA_MISSING");
  const requiredRoles = ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE", "LOCAL_CONTEXTUAL_ATMOSPHERE"];
  const missing = requiredRoles.filter((role) => !bundle.media.some((item) => item.role === role));
  if (missing.length || bundle.composition.blockers.length || bundle.composition.validationState !== "READY_FOR_OWNER_REVIEW") throw new Error(`LOCALIZED_COMPOSITION_BLOCKED:${missing.join(",")}`);
  const loaded = load(); const existing = loaded.state.bundles.find((item) => item.bundleId === bundle.bundleId);
  if (existing) { if (JSON.stringify(existing) !== JSON.stringify(bundle)) throw new Error("LOCAL_PAGE_THEMING_BUNDLE_COLLISION"); return deepClone(existing); }
  loaded.state.bundles.push(deepClone(bundle)); savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision }); return deepClone(bundle);
}

export function getLocalPageThemingBundle(input: { organizationId: string; siteId: string; jobId: string; bundleId?: string }): LocalPageThemingBundle | null {
  const bundles = load().state.bundles.filter((item) => item.context.identity.organizationId === input.organizationId && item.context.identity.siteId === input.siteId && item.context.identity.jobId === input.jobId && (!input.bundleId || item.bundleId === input.bundleId));
  return bundles.length ? deepClone(bundles.at(-1)!) : null;
}

export function saveLocalPageThemingMedia(input: { bundleId: string; mediaId: string; mimeType: LocalizedMediaPlanItem["mimeType"]; bytes: Buffer }): { storageKey: string; sha256: string; byteSize: number } {
  if (!input.bytes.length || input.bytes.length > 20_000_000) throw new Error("LOCAL_THEME_MEDIA_BINARY_INVALID");
  const signature = input.bytes.subarray(0, 12); const valid = input.mimeType === "image/jpeg" ? signature.subarray(0, 3).toString("hex") === "ffd8ff" : input.mimeType === "image/png" ? signature.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" : signature.subarray(8, 12).toString("ascii") === "WEBP"; if (!valid) throw new Error("LOCAL_THEME_MEDIA_SIGNATURE_INVALID");
  const extension = input.mimeType === "image/jpeg" ? "jpg" : input.mimeType === "image/png" ? "png" : "webp"; const safe = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "-"); const storageKey = `${safe(input.bundleId)}/${safe(input.mediaId)}.${extension}`; const fullPath = join(/* turbopackIgnore: true */ resolvePersistenceRoot(), MEDIA_DIRECTORY, storageKey); mkdirSync(dirname(fullPath), { recursive: true }); writeFileSync(fullPath, input.bytes); return { storageKey, sha256: createHash("sha256").update(input.bytes).digest("hex"), byteSize: input.bytes.length };
}

export function readLocalPageThemingMedia(input: { organizationId: string; siteId: string; jobId: string; mediaId: string }): { item: LocalizedMediaPlanItem; bytes: Buffer } | null {
  const bundle = getLocalPageThemingBundle(input); const item = bundle?.media.find((candidate) => candidate.mediaId === input.mediaId); if (!bundle || !item || item.source !== "GENERATED_CANDIDATE") return null;
  const extension = item.mimeType === "image/jpeg" ? "jpg" : item.mimeType === "image/png" ? "png" : "webp"; const safe = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "-"); const bytes = readFileSync(join(/* turbopackIgnore: true */ resolvePersistenceRoot(), MEDIA_DIRECTORY, `${safe(bundle.bundleId)}/${safe(item.mediaId)}.${extension}`)); if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error("LOCAL_THEME_MEDIA_STORAGE_MISMATCH"); return { item: deepClone(item), bytes };
}