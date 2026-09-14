import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { listSites } from "@/modules/foundation/site-repository";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { listAllGlwCampaignTargets } from "@/modules/glw/campaign-target-repository";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => typeof value === "string" ? value : value?.[0] ?? "";

export default async function TargetsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const organizationId = first(params.organizationId);
  const siteId = first(params.siteId);
  const campaignId = first(params.campaignId);
  const stateCode = first(params.state).toUpperCase();
  const sites = listSites();
  const campaigns = listGlwCampaigns();
  const campaignMap = new Map(campaigns.map((campaign) => [campaign.campaignId, campaign]));
  const siteMap = new Map(sites.map((site) => [site.siteId, site]));
  const jobs = new Map((await glwPageExecutionRepository.list()).map((job) => [job.jobId, job]));
  const targets = listAllGlwCampaignTargets().filter((target) =>
    (!organizationId || target.organizationId === organizationId)
    && (!siteId || target.siteId === siteId)
    && (!campaignId || target.campaignId === campaignId)
    && (!stateCode || target.stateCode === stateCode));

  return <AppShell><div className="space-y-6">
    <header className="border border-zinc-800 bg-zinc-900/60 p-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">Campaign Operations</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-black">Targets</h1><p className="mt-2 text-sm text-zinc-400">Read-only target inventory across every durable campaign.</p></div><span className="border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold tabular-nums">{targets.length} shown</span></div>
    </header>
    <form className="grid gap-3 border border-zinc-800 bg-zinc-900/40 p-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Target filters">
      <select name="organizationId" defaultValue={organizationId} className="h-10 min-w-0 border border-zinc-700 bg-zinc-950 px-3 text-sm"><option value="">All organizations</option>{Array.from(new Set(sites.map((site) => site.organizationId))).map((id) => <option key={id} value={id}>{id}</option>)}</select>
      <select name="siteId" defaultValue={siteId} className="h-10 min-w-0 border border-zinc-700 bg-zinc-950 px-3 text-sm"><option value="">All sites</option>{sites.filter((site) => !organizationId || site.organizationId === organizationId).map((site) => <option key={site.siteId} value={site.siteId}>{site.displayName}</option>)}</select>
      <select name="campaignId" defaultValue={campaignId} className="h-10 min-w-0 border border-zinc-700 bg-zinc-950 px-3 text-sm"><option value="">All campaigns</option>{campaigns.filter((campaign) => (!organizationId || campaign.organizationId === organizationId) && (!siteId || campaign.siteId === siteId)).map((campaign) => <option key={campaign.campaignId} value={campaign.campaignId}>{campaign.name}</option>)}</select>
      <input name="state" defaultValue={stateCode} maxLength={2} placeholder="State" aria-label="State code" className="h-10 min-w-0 border border-zinc-700 bg-zinc-950 px-3 text-sm uppercase" />
      <button className="h-10 bg-red-600 px-4 text-sm font-bold">Apply filters</button>
    </form>
    <div className="overflow-x-auto border border-zinc-800"><table className="w-full min-w-[920px] text-left text-sm"><thead className="bg-zinc-900 text-xs uppercase text-zinc-500"><tr>{["Target", "Campaign / site", "State", "WordPress", "Job / execution", "Attention", "Next safe action"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-zinc-800">{targets.map((target) => { const campaign = campaignMap.get(target.campaignId); const site = siteMap.get(target.siteId); const job = target.jobId ? jobs.get(target.jobId) : null; const attention = target.status === "failed" || target.status === "skipped" || target.status === "content_ready" ? "ACTION REQUIRED" : target.status === "running" ? "RUNNING" : target.status === "queued" ? "READY" : "COMPLETE"; const next = target.status === "content_ready" ? "Review generated content" : target.status === "draft_ready" ? "Review generated page" : target.status === "queued" ? "Owner authorization required" : target.status === "failed" ? "Inspect terminal evidence" : target.status === "skipped" ? "Review recovered object" : "No action required"; return <tr key={target.targetId} className="bg-zinc-950/40 align-top"><td className="px-4 py-4"><p className="font-semibold text-white">{target.cityName ?? target.stateCode}</p><p className="mt-1 max-w-56 break-all text-xs text-zinc-600">{target.targetId}</p></td><td className="px-4 py-4"><Link className="font-medium text-zinc-200 hover:text-red-300" href={`/glw/campaigns/${encodeURIComponent(target.campaignId)}?organizationId=${encodeURIComponent(target.organizationId)}&siteId=${encodeURIComponent(target.siteId)}`}>{campaign?.name ?? target.campaignId}</Link><p className="mt-1 text-xs text-zinc-500">{site?.displayName ?? target.siteId}</p></td><td className="px-4 py-4 text-zinc-300">{target.stateCode}</td><td className="px-4 py-4 text-zinc-300">{target.wordpressObjectId ? `#${target.wordpressObjectId}` : "None"}</td><td className="px-4 py-4 text-xs text-zinc-400"><p>{target.jobId ?? "No job"}</p><p className="mt-1">{job?.externalExecutionId ?? "No execution"}</p></td><td className="px-4 py-4"><span className="border border-zinc-700 px-2 py-1 text-xs font-bold">{attention}</span><p className="mt-2 text-xs text-zinc-500">{target.status.replaceAll("_", " ")}</p></td><td className="px-4 py-4 text-zinc-300">{next}</td></tr>;})}</tbody></table>{targets.length === 0 ? <p className="p-8 text-sm text-zinc-400">No targets match this scope.</p> : null}</div>
  </div></AppShell>;
}
