import { GbaSalesWorkspace } from "@/components/gba/gba-sales-workspace";
import { resolveGbaSalesPermissions } from "../access";

export default async function SalesAgentRecommendationsPage() {
  const permissions = await resolveGbaSalesPermissions("/glw/sales-agent/recommendations");
  return <GbaSalesWorkspace mode="recommendations" permissions={permissions} />;
}
