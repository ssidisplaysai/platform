import { AppShell } from "@/components/layout/app-shell";
import { CampaignManagerPage } from "@/modules/glw/CampaignManagerPage";

export const dynamic = "force-dynamic";

export default function GlwCampaignsRoute() {
  return <AppShell><CampaignManagerPage /></AppShell>;
}