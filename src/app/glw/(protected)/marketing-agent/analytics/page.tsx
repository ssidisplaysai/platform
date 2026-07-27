import { GbaMarketingWorkspace } from "@/components/gba/gba-marketing-workspace";
import { resolveGbaMarketingPermissions } from "../access";

export default async function MarketingAnalyticsPage() {
  const permissions = await resolveGbaMarketingPermissions("/glw/marketing-agent/analytics");
  return <GbaMarketingWorkspace mode="analytics" permissions={permissions} />;
}
