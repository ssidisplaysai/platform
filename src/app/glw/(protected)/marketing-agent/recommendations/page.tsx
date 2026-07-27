import { GbaMarketingWorkspace } from "@/components/gba/gba-marketing-workspace";
import { resolveGbaMarketingPermissions } from "../access";

export default async function MarketingRecommendationsPage() {
  const permissions = await resolveGbaMarketingPermissions("/glw/marketing-agent/recommendations");
  return <GbaMarketingWorkspace mode="recommendations" permissions={permissions} />;
}
