import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { createFoundationContext, createSiteContext } from "@/modules/foundation/context";
import { resolvePermissions } from "@/modules/foundation/permissions";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveSiteAccess } from "@/modules/foundation/site-access";
import { evaluateSiteReadiness } from "@/modules/foundation/site-readiness";
import { listSiteActivity } from "@/modules/foundation/site-audit";
import { getSiteIntelligenceWorkspace } from "@/modules/foundation/site-intelligence-repository";
import { getSiteGenerationReadiness } from "@/modules/foundation/site-generation-readiness-service";
import { resolveSiteWorkflowResume } from "@/modules/foundation/site-workflow-resume";

type PageProps = {
  params: Promise<{
    siteId: string;
  }>;
};

export default async function SiteDetailPage({ params }: PageProps) {
  const { siteId } = await params;
  const context = createFoundationContext();
  const permissions = resolvePermissions(context.user.roles);

  const access = resolveSiteAccess({
    site: getSiteById(siteId),
    permissions,
  });

  if (access.status === "not_found") {
    return (
      <AppShell>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          Site {siteId} was not found.
        </div>
      </AppShell>
    );
  }

  if (access.status === "unauthorized") {
    return (
      <AppShell>
        <div className="rounded-2xl border border-amber-600/50 bg-amber-600/10 p-6 text-sm text-amber-200">
          You are not authorized to view this site.
        </div>
      </AppShell>
    );
  }

  if (!access.site) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          Site {siteId} is unavailable.
        </div>
      </AppShell>
    );
  }

  const site = access.site;
  const readiness = evaluateSiteReadiness({
    site,
    organizationActive: true,
    requiredPermission: "sites:manage_integrations",
    permissions,
    intent: "publish",
    requireWorkflowReference: true,
  });

  const activity = listSiteActivity(site.siteId);
  const intelligence = getSiteIntelligenceWorkspace(site.siteId);
  const generation = getSiteGenerationReadiness(site);
  const authorityWorkspace = generation.authority;
  const protectedBlockers = authorityWorkspace.candidates
    .filter((candidate) => (candidate.decision === "APPROVED" || candidate.decision === "QUALIFIED") && candidate.protectedClaimBlockers.length > 0 && candidate.authorityBasis !== "OWNER_ATTESTED_AND_EVIDENCE")
    .flatMap((candidate) => candidate.protectedClaimBlockers.map((blocker) => `${candidate.displayName}: ${blocker}`));
  const workflow = resolveSiteWorkflowResume({
    site,
    intelligence,
    productAuthority: {
      proposed: authorityWorkspace.progress.proposed,
      approved: authorityWorkspace.progress.approved,
      remaining: authorityWorkspace.progress.needReview,
      protectedBlockers,
      candidates: authorityWorkspace.candidates,
    },
    generationReadiness: {
      readyToCertify: generation.readiness.readyToCertify,
      certified: generation.certification.status === "CURRENT",
      stale: generation.certification.status === "STALE",
      blockers: generation.readiness.blockers,
    },
    siteBuildStarted: Boolean(generation.buildSession),
  });

  return (
    <AppShell resourceSite={createSiteContext(site)}>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Site Detail</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{site.siteName}</h1>
          <p className="mt-2 text-sm text-zinc-400">{site.displayName}</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">Technical Status</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
            <span className="rounded-full border border-zinc-700 px-2 py-1">{site.environment}</span>
            <span className="rounded-full border border-zinc-700 px-2 py-1">{site.lifecycleState}</span>
            <span className="rounded-full border border-zinc-700 px-2 py-1">{site.healthStatus}</span>
            <span className="rounded-full border border-zinc-700 px-2 py-1">{site.publishingStatus}</span>
            <span className="rounded-full border border-zinc-700 px-2 py-1">{site.enabled ? "enabled" : "disabled"}</span>
          </div>
        </header>

        <section className="border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Site Build Progress</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Genesis workflow status</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {workflow.stages.map((stage) => (
              <article id={stage.key === "generation_readiness" ? "generation-readiness" : stage.key === "site_build" ? "site-build" : undefined} key={stage.key} className="border border-zinc-800 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white">{stage.label}</h3>
                  <span className={`text-xs font-semibold ${stage.status === "COMPLETE" || stage.status === "APPROVED" ? "text-emerald-300" : stage.status === "IN_PROGRESS" || stage.status === "READY_FOR_REVIEW" ? "text-amber-300" : "text-zinc-400"}`}>{stage.status.replaceAll("_", " ")}</span>
                </div>
                <p className="mt-2 text-xs text-zinc-400">{stage.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-l-4 border-red-600 bg-red-950/20 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-red-300">Next Step</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{workflow.primaryAction.title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-300">{workflow.primaryAction.description}</p>
          <Link href={workflow.primaryAction.href} className="mt-4 inline-block bg-red-600 px-5 py-3 text-sm font-semibold text-white">{workflow.primaryAction.label}</Link>
          {workflow.blockers.length > 0 ? <div className="mt-4 border border-amber-800 bg-amber-950/20 p-4"><h3 className="text-xs font-semibold uppercase text-amber-300">What remains</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-100">{workflow.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div> : null}
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-lg font-semibold text-white">Configuration</h2>
            <dl className="mt-3 space-y-2 text-sm text-zinc-300">
              <div><dt className="text-zinc-500">Site ID</dt><dd>{site.siteId}</dd></div>
              <div><dt className="text-zinc-500">Organization</dt><dd>{site.organizationId}</dd></div>
              <div><dt className="text-zinc-500">Domain</dt><dd>{site.domain ?? "Not configured"}</dd></div>
              <div><dt className="text-zinc-500">Canonical URL</dt><dd>{site.canonicalUrl ?? "Not configured"}</dd></div>
              <div><dt className="text-zinc-500">WordPress API</dt><dd>{site.integrations.wordpressApiBaseUrl ?? "Not configured"}</dd></div>
              <div><dt className="text-zinc-500">Credential Ref</dt><dd>{site.integrations.wordpressCredentialReference ?? "Not configured"}</dd></div>
              <div><dt className="text-zinc-500">Workflow Ref</dt><dd>{site.integrations.workflowReference ?? "Not configured"}</dd></div>
            </dl>
          </article>

          <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-lg font-semibold text-white">Publishing Readiness</h2>
            <p className="mt-2 text-xs text-zinc-400">Separate later gate. These conditions do not block bounded draft generation.</p>
            <p className="mt-2 text-sm text-zinc-300">Status: {readiness.status}</p>
            <p className="text-sm text-zinc-300">Ready: {readiness.ready ? "Yes" : "No"}</p>
            <ul className="mt-3 space-y-1 text-xs text-amber-300">
              {readiness.blockingReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            {readiness.warnings.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs text-zinc-400">
                {readiness.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </article>
        </div>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Recent Application Activity</h2>
          {activity.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">No application-level site activity recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              {activity.map((entry) => (
                <li key={entry.activityId}>{entry.createdAt} - {entry.type} - {entry.summary}</li>
              ))}
            </ul>
          )}
        </article>

        <div className="flex flex-wrap gap-3" aria-label="Secondary site actions">
          <Link href={`/sites/${site.siteId}/intelligence?organizationId=${encodeURIComponent(site.organizationId)}&siteId=${encodeURIComponent(site.siteId)}`} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white">View Site Intelligence</Link>
          <Link href={`/sites/${site.siteId}/settings?organizationId=${encodeURIComponent(site.organizationId)}&siteId=${encodeURIComponent(site.siteId)}`} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white">Site Settings</Link>
          <Link href={`/sites/${site.siteId}/health?organizationId=${encodeURIComponent(site.organizationId)}&siteId=${encodeURIComponent(site.siteId)}`} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white">Site Health</Link>
        </div>
      </section>
    </AppShell>
  );
}
