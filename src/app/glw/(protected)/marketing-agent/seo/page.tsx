import { GbaMarketingWorkspace } from "@/components/gba/gba-marketing-workspace";
import { resolveGbaMarketingPermissions } from "../access";

export default async function MarketingSeoPage() {
  const permissions = await resolveGbaMarketingPermissions("/glw/marketing-agent/seo");
  return <GbaMarketingWorkspace mode="seo" permissions={permissions} />;
}
