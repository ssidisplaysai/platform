import { GbaMarketingWorkspace } from "@/components/gba/gba-marketing-workspace";
import { resolveGbaMarketingPermissions } from "../access";

export default async function MarketingStrategyPage() {
  const permissions = await resolveGbaMarketingPermissions("/glw/marketing-agent/strategy");
  return <GbaMarketingWorkspace mode="strategy" permissions={permissions} />;
}
