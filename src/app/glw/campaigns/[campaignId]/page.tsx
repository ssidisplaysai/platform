import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { GlwCampaignOperatorControls } from "@/modules/glw/GlwCampaignOperatorControls";
import { GlwCampaignOperationsOverview } from "@/modules/glw/GlwCampaignOperationsOverview";
import { buildGlwCampaignOperatorReadModel } from "@/modules/glw/campaign-operator-read-model";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteProps = {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ organizationId?: string | string[]; siteId?: string | string[] }>;
};

function first(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : value?.[0] ?? null;
}

export default async function GlwCampaignDetailPage({ params, searchParams }: RouteProps) {
  const { campaignId } = await params;
  const query = await searchParams;
  const model = await buildGlwCampaignOperatorReadModel(campaignId);

  if (!model) {
    notFound();
  }

  const listParams = new URLSearchParams();
  listParams.set("organizationId", first(query.organizationId) ?? model.campaign.organizationId);
  listParams.set("siteId", first(query.siteId) ?? model.campaign.siteId);

  return (
    <AppShell>
      <div className="min-w-0 max-w-full space-y-6 overflow-hidden">
        <Link href={`/glw/campaigns?${listParams.toString()}`} className="inline-flex text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-white">← Back to campaigns</Link>
        <header className="border border-zinc-800 bg-zinc-900/60 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-400">GLW Campaign Detail</p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-white">{model.campaign.name}</h1>
              <p className="mt-2 text-sm text-zinc-300">
                {model.campaign.pageType.replaceAll("_", " ")} · {model.campaign.pagesPerDay}/day · {model.campaign.publicationPolicy.replaceAll("_", " ")}
              </p>
              <code className="mt-2 block break-all text-xs text-zinc-600">{model.campaign.campaignId}</code>
            </div>
            <span className="border border-zinc-700 px-3 py-1 text-xs uppercase text-zinc-300">
              {model.campaign.status}
            </span>
          </div>
        </header>

        <GlwCampaignOperationsOverview model={model} />

        <GlwCampaignOperatorControls
          campaignId={model.campaign.campaignId}
          organizationId={model.campaign.organizationId}
          siteId={model.campaign.siteId}
          campaignStatus={model.campaign.status}
        />
      </div>
    </AppShell>
  );
}
