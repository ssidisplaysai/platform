"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { GlwCampaign } from "./campaign-types";
import { GLW_CAMPAIGN_US_STATES } from "./campaign-geography";
import { GlwCampaignKnowledgePack } from "./GlwCampaignKnowledgePack";

type SiteOption = { siteId: string; organizationId: string; displayName: string };
type ProductOption = { productId: string; organizationId: string; displayName: string; assignedSiteIds: readonly string[] };
type Props = { organizationId: string; siteId: string | null; sites: readonly SiteOption[]; products: readonly ProductOption[]; initialCampaigns: readonly GlwCampaign[] };

export function GlwCampaignManager({ organizationId, siteId, sites, products, initialCampaigns }: Props) {
  const initialSiteId = siteId ?? sites[0]?.siteId ?? "";
  const [selectedSiteId, setSelectedSiteId] = useState(initialSiteId);
  const availableProducts = useMemo(() => products.filter((product) => product.organizationId === organizationId && product.assignedSiteIds.includes(selectedSiteId)), [organizationId, products, selectedSiteId]);
  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [pagesPerDay, setPagesPerDay] = useState(10);
  const [publicationPolicy, setPublicationPolicy] = useState<"draft_only" | "publish_after_gates">("publish_after_gates");
  const [allStates, setAllStates] = useState(true);
  const [campaigns, setCampaigns] = useState<readonly GlwCampaign[]>(initialCampaigns);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [queueSummaries, setQueueSummaries] = useState<Record<string, {
    total: number;
    referenceComplete: number;
    queued: number;
    running: number;
    draftReady: number;
    published: number;
    failed: number;
    skipped: number;
  }>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadQueueSummaries() {
      const activeCampaigns = campaigns.filter(
        (campaign) => campaign.status === "active",
      );

      if (activeCampaigns.length === 0) {
        return;
      }

      const entries = await Promise.all(
        activeCampaigns.map(async (campaign) => {
          const response = await fetch(
            `/api/glw/campaigns/${campaign.campaignId}/scheduler`,
            {
              method: "GET",
              headers: {
                "x-gcp-roles": "platform_admin",
                "x-gcp-organization-id": organizationId,
                "x-gcp-site-id": campaign.siteId,
              },
              cache: "no-store",
            },
          );

          if (!response.ok) {
            return null;
          }

          const payload = await response.json() as {
            queue?: {
              total: number;
              referenceComplete: number;
              queued: number;
              running: number;
              draftReady: number;
              published: number;
              failed: number;
              skipped: number;
            };
          };

          if (!payload.queue) {
            return null;
          }

          return {
            campaignId: campaign.campaignId,
            queue: payload.queue,
          };
        }),
      );

      if (cancelled) {
        return;
      }

      const next: Record<string, {
        total: number;
        referenceComplete: number;
        queued: number;
        running: number;
        draftReady: number;
        published: number;
        failed: number;
        skipped: number;
      }> = {};

      for (const entry of entries) {
        if (entry) {
          next[entry.campaignId] = entry.queue;
        }
      }

      setQueueSummaries(next);
    }

    void loadQueueSummaries();

    return () => {
      cancelled = true;
    };
  }, [campaigns, organizationId]);

  async function createCampaign() {
    setSaving(true); setMessage(null);
    const response = await fetch("/api/glw/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-gcp-roles": "platform_admin", "x-gcp-organization-id": organizationId, ...(selectedSiteId ? { "x-gcp-site-id": selectedSiteId } : {}) },
      body: JSON.stringify({ organizationId, siteId: selectedSiteId, productId, name, pageType: "state_service", stateCodes: allStates ? GLW_CAMPAIGN_US_STATES.map((state) => state.code) : [], pagesPerDay, publicationPolicy, imageRequired: true }),
    });
    const payload = (await response.json()) as { campaign?: GlwCampaign; errors?: string[]; error?: string };
    if (!response.ok || !payload.campaign) { setMessage(payload.errors?.join(" ") ?? payload.error ?? "Unable to create campaign."); setSaving(false); return; }
    setCampaigns((current) => [payload.campaign!, ...current]); setName(""); setProductId(""); setMessage("Campaign saved as draft. Add references and approve a reference page before activation."); setSaving(false);
  }

  return <div className="space-y-6">
    <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-red-400">GLW Campaign Manager</p>
      <h1 className="mt-3 text-3xl font-black text-white">Production Campaigns</h1>
      <p className="mt-2 max-w-3xl text-sm text-zinc-300">Configure the campaign, attach source material, generate a reference page, and approve it before production activation.</p>
    </header>
    <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-white">New Campaign</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-zinc-300">Site<select value={selectedSiteId} onChange={(event) => {
            const nextSiteId = event.target.value;

            setSelectedSiteId(nextSiteId);
            setProductId("");

            const params = new URLSearchParams(window.location.search);
            params.set("organizationId", organizationId);
            params.set("siteId", nextSiteId);

            window.location.href =
              `${window.location.pathname}?${params.toString()}`;
          }} className="mt-2 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white">{sites.map((site) => <option key={site.siteId} value={site.siteId}>{site.displayName}</option>)}</select></label>
          <label className="text-sm text-zinc-300">Product / Service<select value={productId} onChange={(event) => setProductId(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white"><option value="">Select product</option>{availableProducts.map((product) => <option key={product.productId} value={product.productId}>{product.displayName}</option>)}</select></label>
          <label className="text-sm text-zinc-300 md:col-span-2">Campaign Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Indoor LED Sphere - 50 State Overview" className="mt-2 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white" /></label>
          <label className="text-sm text-zinc-300">Geography<select value={allStates ? "all" : "custom"} onChange={(event) => setAllStates(event.target.value === "all")} className="mt-2 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white"><option value="all">All 50 U.S. States</option><option value="custom" disabled>Custom selection - next slice</option></select></label>
          <label className="text-sm text-zinc-300">Pages per day<input type="number" min={1} max={100} value={pagesPerDay} onChange={(event) => setPagesPerDay(Number(event.target.value))} className="mt-2 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white" /></label>
          <label className="text-sm text-zinc-300 md:col-span-2">Publication Policy<select value={publicationPolicy} onChange={(event) => setPublicationPolicy(event.target.value as "draft_only" | "publish_after_gates")} className="mt-2 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white"><option value="publish_after_gates">Auto-publish only after all gates pass</option><option value="draft_only">Draft only</option></select></label>
        </div>
        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300"><div className="flex justify-between"><span>Targets</span><strong className="text-white">{allStates ? 50 : 0}</strong></div><div className="mt-2 flex justify-between"><span>Minimum daily throughput</span><strong className="text-white">{pagesPerDay}</strong></div><div className="mt-2 flex justify-between"><span>Image required</span><strong className="text-white">Yes</strong></div></div>
        {message ? <p className="mt-4 text-sm text-amber-300">{message}</p> : null}
        <button type="button" disabled={saving || !selectedSiteId || !productId || !name.trim()} onClick={createCampaign} className="mt-5 rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Saving..." : "Save Campaign Draft"}</button>
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-white">Campaigns</h2>
        <div className="mt-4 space-y-3">
          {campaigns.length === 0 ? <p className="text-sm text-zinc-400">No campaigns configured yet.</p> : campaigns.map((campaign) => <article key={campaign.campaignId} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 transition hover:border-zinc-700">
            <div className="flex items-start justify-between gap-3"><div><Link href={`/glw/campaigns/${campaign.campaignId}`} className="font-semibold text-white hover:text-red-300">{campaign.name}</Link><p className="mt-1 text-xs text-zinc-500">{campaign.stateCodes.length} states · {campaign.pagesPerDay}/day</p></div><span className="rounded-full border border-zinc-700 px-2 py-1 text-xs uppercase text-zinc-300">{campaign.status}</span></div>
            {(() => {
              const queue = queueSummaries[campaign.campaignId];

              const completeCount = queue
                ? queue.referenceComplete + queue.draftReady + queue.published
                : campaign.completedTargetCount;

              const failedCount = queue
                ? queue.failed
                : campaign.failedTargetCount;

              const totalCount = queue?.total ?? campaign.stateCodes.length;
              const queuedCount = queue?.queued ?? null;
              const runningCount = queue?.running ?? null;

              return (
                <>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full bg-red-600"
                      style={{
                        width: `${
                          totalCount > 0
                            ? Math.round((completeCount / totalCount) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>

                  <p className="mt-2 text-xs text-zinc-500">
                    {completeCount}/{totalCount} complete · {failedCount} failed
                    {queuedCount !== null ? ` · ${queuedCount} queued` : ""}
                    {runningCount !== null ? ` · ${runningCount} running` : ""}
                  </p>
                </>
              );
            })()}

            <Link href={`/glw/campaigns/${campaign.campaignId}`} className="mt-3 inline-block text-xs uppercase tracking-wider text-red-400 hover:text-red-300">Open campaign</Link>
            {campaign.status === "draft" ? <GlwCampaignKnowledgePack campaign={campaign} organizationId={organizationId} /> : null}
          </article>)}
        </div>
      </div>
    </section>
  </div>;
}
