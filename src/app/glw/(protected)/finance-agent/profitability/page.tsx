import { GbaFinanceWorkspace } from "@/components/gba/gba-finance-workspace";
import { resolveGbaFinancePermissions } from "../access";

export default async function FinanceAgentProfitabilityPage() {
  const permissions = await resolveGbaFinancePermissions("/glw/finance-agent/profitability");
  return <GbaFinanceWorkspace mode="profitability" permissions={permissions} />;
}
