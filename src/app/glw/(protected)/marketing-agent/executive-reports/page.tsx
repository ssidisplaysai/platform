import { GbaMarketingWorkspace } from "@/components/gba/gba-marketing-workspace";
import { resolveGbaMarketingPermissions } from "../access";

export default async function MarketingExecutiveReportsPage() {
  const permissions = await resolveGbaMarketingPermissions("/glw/marketing-agent/executive-reports");
  return <GbaMarketingWorkspace mode="executive-reports" permissions={permissions} />;
}
