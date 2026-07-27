import { GbaMarketingWorkspace } from "@/components/gba/gba-marketing-workspace";
import { resolveGbaMarketingPermissions } from "../access";

export default async function MarketingCampaignsPage() {
  const permissions = await resolveGbaMarketingPermissions("/glw/marketing-agent/campaigns");
  return <GbaMarketingWorkspace mode="campaigns" permissions={permissions} />;
}
