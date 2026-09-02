import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { listGlwCampaignTargets, summarizeGlwCampaignTargets } from "@/modules/glw/campaign-target-repository";
import { GlwCampaignOperatorControls } from "@/modules/glw/GlwCampaignOperatorControls";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteProps = {
  params: Promise<{ campaignId: string }>;
};

function labelStatus(status: string): string {
  return status.replace(/_/g, " ");
}

export default async function GlwCampaignDetailPage({ params }: RouteProps) {
  const { campaignId } = await params;
  const campaign = listGlwCampaigns().find((entry) => entry.campaignId === campaignId) ?? null;

  if (!campaign) {
    notFound();
  }

  const targets = listGlwCampaignTargets(campaign.campaignId)
    .slice()
    .sort((a, b) => a.stateCode.localeCompare(b.stateCode));
  const queue = summarizeGlwCampaignTargets(campaign.campaignId);

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-400">GLW Campaign Detail</p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-white">{campaign.name}</h1>
              <p className="mt-2 text-sm text-zinc-300">
                {campaign.stateCodes.length} states · {campaign.pagesPerDay}/day · {campaign.publicationPolicy}
              </p>
            </div>
            <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs uppercase text-zinc-300">
              {campaign.status}
            </span>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"><p className="text-xs uppercase tracking-wider text-zinc-500">Complete</p><p className="mt-2 text-2xl font-bold text-white">{queue.referenceComplete + queue.draftReady + queue.published}</p></div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"><p className="text-xs uppercase tracking-wider text-zinc-500">Queued</p><p className="mt-2 text-2xl font-bold text-white">{queue.queued}</p></div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"><p className="text-xs uppercase tracking-wider text-zinc-500">Running</p><p className="mt-2 text-2xl font-bold text-white">{queue.running}</p></div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"><p className="text-xs uppercase tracking-wider text-zinc-500">Failed</p><p className="mt-2 text-2xl font-bold text-white">{queue.failed}</p></div>
        </section>

        <GlwCampaignOperatorControls
          campaignId={campaign.campaignId}
          organizationId={campaign.organizationId}
          siteId={campaign.siteId}
          campaignStatus={campaign.status}
        />

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">State Targets</h2>
              <p className="mt-1 text-sm text-zinc-400">Campaign queue view. Draft dispatch is explicit and publication remains a separate protected action.</p>
            </div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">{targets.length} targets</p>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-3 py-3">State</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Job</th>
                  <th className="px-3 py-3">WordPress</th>
                  <th className="px-3 py-3">Attempts</th>
                  <th className="px-3 py-3">Dispatch Date</th>
                  <th className="px-3 py-3">Last Error</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((target) => (
                  <tr key={target.targetId} className="border-b border-zinc-900 text-zinc-300">
                    <td className="px-3 py-3 font-semibold text-white">{target.stateCode}</td>
                    <td className="px-3 py-3"><span className="rounded-full border border-zinc-700 px-2 py-1 text-xs uppercase">{labelStatus(target.status)}</span></td>
                    <td className="px-3 py-3 font-mono text-xs text-zinc-400">{target.jobId ?? "—"}</td>
                    <td className="px-3 py-3 font-mono text-xs text-zinc-400">{target.wordpressObjectId ?? "—"}</td>
                    <td className="px-3 py-3">{target.attemptCount}</td>
                    <td className="px-3 py-3 text-zinc-400">{target.dispatchDate ?? "—"}</td>
                    <td className="max-w-[320px] px-3 py-3 text-xs text-amber-300">{target.lastError ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
