import { GbaFinanceWorkspace } from "@/components/gba/gba-finance-workspace";
import { resolveGbaFinancePermissions } from "../access";

export default async function FinanceAgentRecommendationsPage() {
  const permissions = await resolveGbaFinancePermissions("/glw/finance-agent/recommendations");
  return <GbaFinanceWorkspace mode="recommendations" permissions={permissions} />;
}
