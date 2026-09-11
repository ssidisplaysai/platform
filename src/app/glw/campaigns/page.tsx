import { AppShell } from "@/components/layout/app-shell";
import { CampaignManagerPage } from "@/modules/glw/CampaignManagerPage";

export const dynamic = "force-dynamic";

export default async function GlwCampaignsRoute({ searchParams }: { searchParams: Promise<{ organizationId?: string; siteId?: string }> }) {
  const context = await searchParams;
  return <AppShell><CampaignManagerPage organizationId={context.organizationId} siteId={context.siteId} /></AppShell>;
}