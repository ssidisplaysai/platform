import { AppShell } from "@/components/layout/app-shell";
import { getSiteById } from "@/modules/foundation/site-repository";

type PageProps = {
  params: Promise<{
    siteId: string;
  }>;
};

export default async function SiteSettingsPage({ params }: PageProps) {
  const { siteId } = await params;
  const site = getSiteById(siteId);

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Site Settings Foundation</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{site?.siteName ?? "Unknown Site"}</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Bounded editing surface for non-secret fields and opaque integration references.
          </p>
        </header>

        {!site ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
            Site was not found.
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
            <p>Stable Site ID: {site.siteId}</p>
            <p>Organization: {site.organizationId} (reassignment restricted)</p>
            <p>Domain: {site.domain ?? "Not configured"}</p>
            <p>Environment: {site.environment}</p>
            <p>Publishing Defaults: {site.defaultContentType} / {site.defaultPublicationStatus}</p>
            <p>Credential Reference: {site.integrations.wordpressCredentialReference ?? "Not configured"}</p>
            <p>Workflow Reference: {site.integrations.workflowReference ?? "Not configured"}</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
