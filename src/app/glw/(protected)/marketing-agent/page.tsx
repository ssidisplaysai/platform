import { GbaMarketingWorkspace } from "@/components/gba/gba-marketing-workspace";
import { resolveGbaMarketingPermissions } from "./access";

export default async function MarketingAgentDashboardPage() {
  const permissions = await resolveGbaMarketingPermissions("/glw/marketing-agent");
  return <GbaMarketingWorkspace mode="dashboard" permissions={permissions} />;
}
