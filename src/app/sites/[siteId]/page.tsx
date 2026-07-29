import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { createFoundationContext } from "@/modules/foundation/context";
import { resolvePermissions } from "@/modules/foundation/permissions";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveSiteAccess } from "@/modules/foundation/site-access";
import { evaluateSiteReadiness } from "@/modules/foundation/site-readiness";
import { listSiteActivity } from "@/modules/foundation/site-audit";

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

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Site Detail</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{site.siteName}</h1>
          <p className="mt-2 text-sm text-zinc-400">{site.displayName}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
            <span className="rounded-full border border-zinc-700 px-2 py-1">{site.environment}</span>
            <span className="rounded-full border border-zinc-700 px-2 py-1">{site.lifecycleState}</span>
            <span className="rounded-full border border-zinc-700 px-2 py-1">{site.healthStatus}</span>
            <span className="rounded-full border border-zinc-700 px-2 py-1">{site.publishingStatus}</span>
            <span className="rounded-full border border-zinc-700 px-2 py-1">{site.enabled ? "enabled" : "disabled"}</span>
          </div>
        </header>

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

        <div className="flex gap-3">
          <Link href={`/sites/${site.siteId}/settings`} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white">Site Settings</Link>
          <Link href={`/sites/${site.siteId}/health`} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white">Site Health</Link>
        </div>
      </section>
    </AppShell>
  );
}
