import { GbaMarketingWorkspace } from "@/components/gba/gba-marketing-workspace";
import { resolveGbaMarketingPermissions } from "../access";

export default async function MarketingBrandGovernancePage() {
  const permissions = await resolveGbaMarketingPermissions("/glw/marketing-agent/brand-governance");
  return <GbaMarketingWorkspace mode="brand-governance" permissions={permissions} />;
}
