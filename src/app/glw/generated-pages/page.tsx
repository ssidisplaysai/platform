import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { listSites } from "@/modules/foundation/site-repository";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { listAllGlwCampaignTargets } from "@/modules/glw/campaign-target-repository";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { listRenderedVisualCertifications } from "@/modules/foundation/rendered-visual-certification-repository";
import { projectAuthoritativeGeneratedPage } from "@/modules/glw/authoritative-generated-page-projection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => typeof value === "string" ? value : value?.[0] ?? "";

export default async function GeneratedPagesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const organizationId = first(params.organizationId);
  const siteId = first(params.siteId);
  const view = first(params.view) || "review";
  const campaigns = listGlwCampaigns();
  const campaignMap = new Map(campaigns.map((campaign) => [campaign.campaignId, campaign]));
  const siteMap = new Map(listSites().map((site) => [site.siteId, site]));
  const jobs = new Map((await glwPageExecutionRepository.list()).map((job) => [job.jobId, job]));
  const scoped = listAllGlwCampaignTargets().filter((target) => (!organizationId || target.organizationId === organizationId) && (!siteId || target.siteId === siteId)).map((target) => {
    const job = target.jobId ? jobs.get(target.jobId) : null;
    return job ? projectAuthoritativeGeneratedPage({ target, job, certifications: listRenderedVisualCertifications({ organizationId: target.organizationId, siteId: target.siteId, pageId: target.targetId }) }).target : target;
  });
  const targets = scoped.filter((target) => view === "all" ? ["reference_complete", "content_ready", "draft_ready", "published", "failed"].includes(target.status) : ["content_ready", "draft_ready", "failed"].includes(target.status));
  const reviewCount = scoped.filter((target) => target.status === "draft_ready").length;

  return <AppShell><div className="space-y-6">
    <header className="border border-zinc-800 bg-zinc-900/60 p-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">Content Operations</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-black">Generated Pages</h1><p className="mt-2 text-sm text-zinc-400">Owner-reviewable campaign drafts, with existing review workflows reused.</p></div><span className="border border-amber-700 bg-amber-950/30 px-3 py-2 text-sm font-bold text-amber-200">{reviewCount} draft ready</span></div></header>
    <div className="flex flex-wrap gap-2"><Link href="/glw/generated-pages?view=review" aria-current={view === "review" ? "page" : undefined} className={`border px-4 py-2 text-sm ${view === "review" ? "border-red-500 text-white" : "border-zinc-700 text-zinc-400"}`}>Needs review</Link><Link href="/glw/generated-pages?view=all" aria-current={view === "all" ? "page" : undefined} className={`border px-4 py-2 text-sm ${view === "all" ? "border-red-500 text-white" : "border-zinc-700 text-zinc-400"}`}>All generated states</Link></div>
    <div className="grid gap-3">{targets.map((target) => { const job = target.jobId ? jobs.get(target.jobId) : null; const campaign = campaignMap.get(target.campaignId); const reviewHref = target.jobId ? `/glw/pages/${encodeURIComponent(target.jobId)}/review?organizationId=${encodeURIComponent(target.organizationId)}&siteId=${encodeURIComponent(target.siteId)}` : `/glw/campaigns/${encodeURIComponent(target.campaignId)}?organizationId=${encodeURIComponent(target.organizationId)}&siteId=${encodeURIComponent(target.siteId)}`; return <article key={target.targetId} className="grid gap-4 border border-zinc-800 bg-zinc-900/40 p-4 lg:grid-cols-[1fr_auto] lg:items-center"><div className="min-w-0"><div className="flex flex-wrap gap-2"><span className="border border-zinc-700 px-2 py-1 text-xs font-bold uppercase text-zinc-300">{target.status.replaceAll("_", " ")}</span>{job?.status ? <span className="border border-zinc-800 px-2 py-1 text-xs text-zinc-500">Job {job.status.replaceAll("_", " ")}</span> : null}</div><h2 className="mt-3 font-semibold text-white">{target.cityName ?? target.stateCode} · {campaign?.name ?? target.campaignId}</h2><p className="mt-1 text-sm text-zinc-400">{siteMap.get(target.siteId)?.displayName ?? target.siteId}{target.wordpressObjectId ? ` · WordPress #${target.wordpressObjectId}` : " · No WordPress object"}</p><p className="mt-2 text-xs text-zinc-600">{target.targetId}</p></div><Link href={reviewHref} className="inline-flex h-10 items-center justify-center border border-zinc-700 px-4 text-xs font-bold uppercase text-zinc-200 hover:border-red-500">{target.jobId ? "Open review" : "Open campaign"}</Link></article>;})}{targets.length === 0 ? <p className="border border-zinc-800 p-8 text-sm text-zinc-400">No generated pages match this view.</p> : null}</div>
  </div></AppShell>;
}
