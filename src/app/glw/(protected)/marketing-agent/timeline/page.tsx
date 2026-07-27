import { GbaMarketingWorkspace } from "@/components/gba/gba-marketing-workspace";
import { resolveGbaMarketingPermissions } from "../access";

export default async function MarketingTimelinePage() {
  const permissions = await resolveGbaMarketingPermissions("/glw/marketing-agent/timeline");
  return <GbaMarketingWorkspace mode="timeline" permissions={permissions} />;
}
