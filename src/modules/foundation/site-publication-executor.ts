import "server-only";

import { normalizeWordPressApiBaseUrl } from "./authenticated-wordpress-read-authority";
import { getSiteBuildWorkspace } from "./site-build-service";
import { inspectSiteBuildWordPressDrafts } from "./site-build-wordpress-review";
import { checkpointSitePublicationExecutionPlan, type SitePublicationExecutionPlan, type SitePublicationOperation } from "./site-publication-execution-repository";
import { prepareSitePublicationExecutionPlan } from "./site-publication-execution-plan";
import { updateSite } from "./site-repository";
import type { SiteConfiguration } from "./types";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import { publishGenesisWordPressDraft } from "./wordpress-publish-writer";
import { certifyPublicWordPressSite } from "./public-wordpress-certification";

function completed(operation: SitePublicationOperation): SitePublicationOperation { return { ...operation, status: "SUCCEEDED", attemptCount: operation.attemptCount + 1, completedAt: new Date().toISOString(), error: null }; }
function failed(operation: SitePublicationOperation, error: unknown): SitePublicationOperation { return { ...operation, status: "FAILED", attemptCount: operation.attemptCount + 1, completedAt: new Date().toISOString(), error: error instanceof Error ? error.message : "PUBLICATION_OPERATION_FAILED" }; }

export async function executeSitePublication(site: SiteConfiguration): Promise<SitePublicationExecutionPlan> {
  const preflight = await prepareSitePublicationExecutionPlan(site);
  if (!preflight.ready || preflight.navigation.mutationRequired) throw new Error(`PUBLICATION_EXECUTION_PREFLIGHT_BLOCKED:${preflight.blockers.join(",")}`);
  let plan = checkpointSitePublicationExecutionPlan({ executionPlanId: preflight.plan.executionPlanId, status: "EXECUTING", operations: preflight.plan.operations });
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!credential || !site.integrations.wordpressApiBaseUrl) throw new Error("WORDPRESS_EXECUTION_AUTHORITY_REQUIRED");
  const apiBaseUrl = normalizeWordPressApiBaseUrl(site.integrations.wordpressApiBaseUrl);
  const headers = { Accept: "application/json", Authorization: `Basic ${Buffer.from(`${credential.username}:${credential.applicationPassword}`, "utf8").toString("base64")}`, "Content-Type": "application/json", "Cache-Control": "no-cache, no-store" };

  for (let index = 0; index < plan.operations.length; index += 1) {
    const operation = plan.operations[index];
    if (operation.status === "SUCCEEDED" || operation.kind === "FINAL_VERIFICATION" || operation.kind === "TRANSITION_GENESIS_SITE") continue;
    try {
      if (operation.kind === "PUBLISH_PAGE") {
        const result = await publishGenesisWordPressDraft({ site, wordpressObjectId: operation.targetId });
        if (!result.ok) throw new Error(`${result.state}:${result.message}`);
      } else if (operation.kind === "VERIFY_NAVIGATION") {
        if (operation.mutation) throw new Error("WORDPRESS_MENU_WRITER_UNAVAILABLE");
      } else if (operation.kind === "SET_STATIC_FRONT_PAGE" && operation.mutation) {
        const response = await fetch(`${apiBaseUrl}/settings`, { method: "POST", headers, body: JSON.stringify({ show_on_front: "page", page_on_front: Number(operation.targetId) }), cache: "no-store", signal: AbortSignal.timeout(30_000) });
        if (!response.ok) throw new Error(`FRONT_PAGE_WRITE_FAILED:${response.status}`);
        const read = await fetch(`${apiBaseUrl}/settings`, { headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
        const settings = read.ok ? await read.json() as Record<string, unknown> : {};
        if (settings.show_on_front !== "page" || Number(settings.page_on_front) !== Number(operation.targetId)) throw new Error("FRONT_PAGE_VERIFICATION_FAILED");
      } else if (operation.kind === "VERIFY_MEDIA" || operation.kind === "VERIFY_SEO") {
        const review = await inspectSiteBuildWordPressDrafts(site, undefined, "publish");
        if (operation.kind === "VERIFY_MEDIA" && review.media.imagesAttachedToPages !== review.summary.expectedCount) throw new Error("MEDIA_VERIFICATION_FAILED");
        if (operation.kind === "VERIFY_SEO" && review.qa.seoMismatchCount !== 0) throw new Error("SEO_VERIFICATION_FAILED");
      }
      plan.operations[index] = completed(operation);
      plan = checkpointSitePublicationExecutionPlan({ executionPlanId: plan.executionPlanId, status: "EXECUTING", operations: plan.operations });
    } catch (error) {
      plan.operations[index] = failed(operation, error);
      return checkpointSitePublicationExecutionPlan({ executionPlanId: plan.executionPlanId, status: "PARTIALLY_FAILED", operations: plan.operations });
    }
  }

  const finalIndex = plan.operations.findIndex((operation) => operation.kind === "FINAL_VERIFICATION");
  const finalReview = await inspectSiteBuildWordPressDrafts(site, undefined, "publish");
  const finalWorkspace = getSiteBuildWorkspace(site);
  const publicCertification = finalWorkspace.currentAssembly
    ? await certifyPublicWordPressSite({
        spec: {
          canonicalOrigin: site.canonicalUrl,
          wordpressSettings: { home: preflight.settings.home, siteUrl: preflight.settings.siteUrl },
          expectedBrand: site.displayName,
          routes: finalWorkspace.currentAssembly.pages.map((page) => ({
            path: page.canonicalPath,
            expectedH1: page.h1,
          })),
        },
      })
    : null;
  if (!finalReview.qa.readyForSiteQa || finalReview.summary.publishedCount !== finalReview.summary.expectedCount || finalReview.media.imagesAttachedToPages !== finalReview.summary.expectedCount || finalReview.qa.seoMismatchCount !== 0 || !publicCertification?.ready) {
    plan.operations[finalIndex] = failed(plan.operations[finalIndex], new Error("FINAL_WORDPRESS_VERIFICATION_FAILED"));
    return checkpointSitePublicationExecutionPlan({ executionPlanId: plan.executionPlanId, status: "PARTIALLY_FAILED", operations: plan.operations });
  }
  plan.operations[finalIndex] = completed(plan.operations[finalIndex]);
  plan = checkpointSitePublicationExecutionPlan({ executionPlanId: plan.executionPlanId, status: "VERIFYING", operations: plan.operations });

  const genesisIndex = plan.operations.findIndex((operation) => operation.kind === "TRANSITION_GENESIS_SITE");
  const updated = updateSite(site.siteId, { lifecycleState: "active", publishingStatus: "ready", enabled: true, lastSuccessfulPublication: new Date().toISOString() });
  if (!updated.validation.valid || !updated.site) {
    plan.operations[genesisIndex] = failed(plan.operations[genesisIndex], new Error("GENESIS_SITE_TRANSITION_FAILED"));
    return checkpointSitePublicationExecutionPlan({ executionPlanId: plan.executionPlanId, status: "PARTIALLY_FAILED", operations: plan.operations });
  }
  plan.operations[genesisIndex] = completed(plan.operations[genesisIndex]);
  return checkpointSitePublicationExecutionPlan({ executionPlanId: plan.executionPlanId, status: "VERIFIED", operations: plan.operations });
}

export function publicationExecutionSummary(site: SiteConfiguration) {
  const workspace = getSiteBuildWorkspace(site); const plan = workspace.currentPublicationExecutionPlan;
  return { plan, pending: plan?.operations.filter((operation) => operation.status === "PENDING").length ?? 0, succeeded: plan?.operations.filter((operation) => operation.status === "SUCCEEDED").length ?? 0, failed: plan?.operations.filter((operation) => operation.status === "FAILED").length ?? 0 };
}
