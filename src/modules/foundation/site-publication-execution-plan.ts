import "server-only";

import { createHash } from "node:crypto";
import { normalizeWordPressApiBaseUrl } from "./authenticated-wordpress-read-authority";
import { getSiteBuildWorkspace } from "./site-build-service";
import { inspectSiteBuildWordPressDrafts } from "./site-build-wordpress-review";
import { createSitePublicationExecutionFingerprint, saveSitePublicationExecutionPlan, type SitePublicationExecutionPlan } from "./site-publication-execution-repository";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import type { SiteConfiguration } from "./types";

export type SitePublicationExecutionPreflight = {
  ready: boolean;
  plan: SitePublicationExecutionPlan;
  pagePublishCount: number;
  settings: { showOnFront: string | null; pageOnFront: number | null; permalinkStructure: string | null; settingsWritable: boolean };
  navigation: { mode: "VERIFY_EMBEDDED_APPROVED_NAVIGATION" | "WORDPRESS_MENU_MUTATION_REQUIRED"; topLevelCount: number; childCount: number; restRoutes: string[]; mutationRequired: boolean };
  home: { wordpressObjectId: string; assignmentRequired: boolean };
  genesis: { current: string; intended: string };
  checks: { allObjectsStillDraft: boolean; allObjectsInExpectedState: boolean; allObjectIdsMatch: boolean; allSlugsMatch: boolean; allContentRevisionsMatch: boolean; allMediaVerified: boolean; allSeoVerified: boolean; navigationVerified: boolean; frontPageTargetVerified: boolean; duplicateCanonicalCount: number; authorizationStillValid: boolean; executionFingerprintValid: boolean };
  blockers: string[];
};

const idempotencyKey = (value: unknown) => `site-publication-${createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32)}`;

export async function prepareSitePublicationExecutionPlan(site: SiteConfiguration): Promise<SitePublicationExecutionPreflight> {
  const workspace = getSiteBuildWorkspace(site);
  if (!workspace.session || !workspace.currentAssembly || !workspace.currentNavigationReview || workspace.currentNavigationReview.status !== "PUBLICATION_AUTHORIZED") throw new Error("PUBLICATION_AUTHORIZATION_REQUIRED");
  const review = await inspectSiteBuildWordPressDrafts(site);
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!credential || !site.integrations.wordpressApiBaseUrl) throw new Error("WORDPRESS_READ_AUTHORITY_REQUIRED");
  const apiBaseUrl = normalizeWordPressApiBaseUrl(site.integrations.wordpressApiBaseUrl);
  const origin = new URL(apiBaseUrl).origin;
  const headers = { Accept: "application/json", Authorization: `Basic ${Buffer.from(`${credential.username}:${credential.applicationPassword}`, "utf8").toString("base64")}`, "Cache-Control": "no-cache, no-store", Pragma: "no-cache" };
  const [indexResponse, settingsResponse] = await Promise.all([
    fetch(`${origin}/wp-json/`, { headers, cache: "no-store", signal: AbortSignal.timeout(30_000) }),
    fetch(`${apiBaseUrl}/settings`, { headers, cache: "no-store", signal: AbortSignal.timeout(30_000) }),
  ]);
  const index = indexResponse.ok ? await indexResponse.json() as { routes?: Record<string, { methods?: string[] }> } : {};
  const settings = settingsResponse.ok ? await settingsResponse.json() as Record<string, unknown> : {};
  const menuRoutes = Object.keys(index.routes ?? {}).filter((route) => /menu|navigation/.test(route)).sort();
  const settingsMethods = index.routes?.["/wp/v2/settings"]?.methods ?? [];
  const showOnFront = typeof settings.show_on_front === "string" ? settings.show_on_front : null;
  const pageOnFront = Number.isSafeInteger(settings.page_on_front) ? Number(settings.page_on_front) : null;
  const permalinkStructure = typeof settings.permalink_structure === "string" ? settings.permalink_structure : null;
  const homePage = workspace.currentAssembly.pages.find((page) => page.pageRole === "HOME");
  const homeDraft = homePage ? workspace.wordpressDrafts.find((draft) => draft.draftId === `${homePage.pageId}-draft`) : null;
  if (!homeDraft) throw new Error("HOME_WORDPRESS_IDENTITY_REQUIRED");
  const assignmentRequired = showOnFront !== "page" || pageOnFront !== Number(homeDraft.wordpressObjectId);
  const settingsWritable = settingsResponse.ok && settingsMethods.includes("POST");
  const childCount = workspace.currentNavigationReview.items.reduce((count, item) => count + item.children.length, 0);
  const embeddedNavigationVerified = review.qa.contentMismatchCount === 0 && review.summary.verifiedDraftCount === review.summary.expectedCount;
  const navigationMode = embeddedNavigationVerified ? "VERIFY_EMBEDDED_APPROVED_NAVIGATION" as const : "WORDPRESS_MENU_MUTATION_REQUIRED" as const;
  const blockers = [
    ...(assignmentRequired && !settingsWritable ? ["WORDPRESS_FRONT_PAGE_SETTINGS_NOT_WRITABLE"] : []),
    ...(navigationMode === "WORDPRESS_MENU_MUTATION_REQUIRED" && menuRoutes.length === 0 ? ["WORDPRESS_MENU_AUTHORITY_UNAVAILABLE"] : []),
    ...(site.publicationPolicy !== "publish_after_gates" ? ["GENESIS_PUBLICATION_POLICY_TRANSITION_REQUIRED"] : []),
  ];
  const operations = [
    ...review.items.map((item) => ({ kind: "PUBLISH_PAGE" as const, label: `Publish ${item.pageName}`, targetId: item.wordpressObjectId, currentState: item.wordpressStatus ?? "missing", intendedState: "publish", mutation: true, idempotencyKey: idempotencyKey(["PUBLISH_PAGE", item.wordpressObjectId, item.pageRevisionId]) })),
    { kind: "VERIFY_NAVIGATION" as const, label: "Verify approved navigation architecture", targetId: workspace.currentNavigationReview.navigationReviewId, currentState: navigationMode, intendedState: "APPROVED_NAVIGATION_VERIFIED", mutation: navigationMode === "WORDPRESS_MENU_MUTATION_REQUIRED", idempotencyKey: idempotencyKey(["NAVIGATION", workspace.currentNavigationReview.navigationReviewId]) },
    { kind: "SET_STATIC_FRONT_PAGE" as const, label: "Configure approved Home as static front page", targetId: homeDraft.wordpressObjectId, currentState: `${showOnFront ?? "unknown"}:${pageOnFront ?? "unknown"}`, intendedState: `page:${homeDraft.wordpressObjectId}`, mutation: assignmentRequired, idempotencyKey: idempotencyKey(["FRONT_PAGE", homeDraft.wordpressObjectId]) },
    { kind: "VERIFY_MEDIA" as const, label: "Verify approved media attachments", targetId: site.siteId, currentState: `${review.media.imagesAttachedToPages}/${review.summary.expectedCount}`, intendedState: `${review.summary.expectedCount}/${review.summary.expectedCount}`, mutation: false, idempotencyKey: idempotencyKey(["MEDIA", workspace.currentAssembly.assemblyId]) },
    { kind: "VERIFY_SEO" as const, label: "Verify approved Yoast SEO state", targetId: site.siteId, currentState: `${review.qa.seoMismatchCount} mismatches`, intendedState: "0 mismatches", mutation: false, idempotencyKey: idempotencyKey(["SEO", workspace.currentAssembly.assemblyId]) },
    { kind: "FINAL_VERIFICATION" as const, label: "Authenticate final WordPress launch state", targetId: site.siteId, currentState: "pending", intendedState: "15 published pages verified", mutation: false, idempotencyKey: idempotencyKey(["FINAL_VERIFY", workspace.session.buildSessionId]) },
    { kind: "TRANSITION_GENESIS_SITE" as const, label: "Transition Genesis site state after verification", targetId: site.siteId, currentState: `${site.lifecycleState}:${site.publishingStatus}:${site.enabled}`, intendedState: "active:ready:true", mutation: true, idempotencyKey: idempotencyKey(["GENESIS_STATE", workspace.session.buildSessionId]) },
  ];
  const currentFingerprint = createSitePublicationExecutionFingerprint(operations);
  const existingPlan = workspace.currentPublicationExecutionPlan;
  const replaceUnusedLegacyPlan = Boolean(existingPlan && existingPlan.status === "READY_FOR_EXECUTION" && existingPlan.operations.every((operation) => operation.attemptCount === 0) && existingPlan.fingerprint !== currentFingerprint);
  const plan = !existingPlan || replaceUnusedLegacyPlan ? saveSitePublicationExecutionPlan({ organizationId: site.organizationId, siteId: site.siteId, buildSessionId: workspace.session.buildSessionId, authorizationReviewId: workspace.currentNavigationReview.navigationReviewId, operations }) : existingPlan;
  const allObjectsInExpectedState = review.items.every((item) => { const receipt = plan.operations.find((operation) => operation.kind === "PUBLISH_PAGE" && operation.targetId === item.wordpressObjectId); return item.wordpressStatus === (receipt?.status === "SUCCEEDED" ? "publish" : "draft"); });
  const checks = { allObjectsStillDraft: review.items.every((item) => item.wordpressStatus === "draft"), allObjectsInExpectedState, allObjectIdsMatch: review.summary.allObjectIdsMatchReceipts, allSlugsMatch: review.summary.allCanonicalSlugsCorrect, allContentRevisionsMatch: review.qa.contentMismatchCount === 0, allMediaVerified: review.media.imagesAttachedToPages === review.summary.expectedCount, allSeoVerified: review.qa.seoMismatchCount === 0, navigationVerified: embeddedNavigationVerified, frontPageTargetVerified: review.items.some((item) => item.wordpressObjectId === homeDraft.wordpressObjectId && ["draft", "publish"].includes(item.wordpressStatus ?? "")), duplicateCanonicalCount: review.summary.duplicateObjectCount + review.qa.duplicateSlugCount, authorizationStillValid: workspace.currentNavigationReview.status === "PUBLICATION_AUTHORIZED", executionFingerprintValid: plan.fingerprint === currentFingerprint };
  const requiredChecksPass = checks.allObjectsInExpectedState && checks.allObjectIdsMatch && checks.allSlugsMatch && checks.allContentRevisionsMatch && checks.allMediaVerified && checks.allSeoVerified && checks.navigationVerified && checks.frontPageTargetVerified && checks.duplicateCanonicalCount === 0 && checks.authorizationStillValid && checks.executionFingerprintValid;
  if (!requiredChecksPass) blockers.push("CURRENT_APPROVED_STATE_FINGERPRINT_MISMATCH");
  return { ready: blockers.length === 0, plan, pagePublishCount: review.items.length, settings: { showOnFront, pageOnFront, permalinkStructure, settingsWritable }, navigation: { mode: navigationMode, topLevelCount: workspace.currentNavigationReview.items.length, childCount, restRoutes: menuRoutes, mutationRequired: navigationMode === "WORDPRESS_MENU_MUTATION_REQUIRED" }, home: { wordpressObjectId: homeDraft.wordpressObjectId, assignmentRequired }, genesis: { current: `${site.lifecycleState}:${site.publishingStatus}:${site.enabled}`, intended: "active:ready:true" }, checks, blockers };
}
