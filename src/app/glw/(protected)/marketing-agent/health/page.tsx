import { GbaMarketingWorkspace } from "@/components/gba/gba-marketing-workspace";
import { resolveGbaMarketingPermissions } from "../access";

export default async function MarketingHealthPage() {
  const permissions = await resolveGbaMarketingPermissions("/glw/marketing-agent/health");
  return <GbaMarketingWorkspace mode="health" permissions={permissions} />;
}
