import { AppShell } from "@/components/layout/app-shell";
import { FoundationSiteConnectionTestAdapter } from "@/modules/foundation/site-connection";
import { getSiteById } from "@/modules/foundation/site-repository";
import { evaluateSiteReadiness } from "@/modules/foundation/site-readiness";
import { resolvePermissions } from "@/modules/foundation/permissions";

type PageProps = {
  params: Promise<{
    siteId: string;
  }>;
};

export default async function SiteHealthPage({ params }: PageProps) {
  const { siteId } = await params;
  const site = getSiteById(siteId);

  if (!site) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          Site was not found.
        </div>
      </AppShell>
    );
  }

  const adapter = new FoundationSiteConnectionTestAdapter();
  const connectionResult = await adapter.testConnection(site);
  const readiness = evaluateSiteReadiness({
    site,
    organizationActive: true,
    requiredPermission: "sites:view_health",
    permissions: resolvePermissions(["ops_manager"]),
    intent: "connection_test",
    requireWorkflowReference: false,
  });

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Site Health Foundation</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{site.siteName}</h1>
          <p className="mt-2 text-sm text-zinc-400">Connection and readiness foundation contract.</p>
        </header>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          <p>Connection Test Status: {connectionResult.status}</p>
          <p>Message: {connectionResult.message}</p>
          <p>Checked At: {connectionResult.checkedAt}</p>
          {connectionResult.details ? <p>Details: {connectionResult.details}</p> : null}
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          <p>Readiness Status: {readiness.status}</p>
          <p>Ready: {readiness.ready ? "Yes" : "No"}</p>
          <ul className="mt-2 space-y-1 text-xs text-amber-300">
            {readiness.blockingReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </article>
      </section>
    </AppShell>
  );
}
