import { GbaFinanceWorkspace } from "@/components/gba/gba-finance-workspace";
import { resolveGbaFinancePermissions } from "../access";

export default async function FinanceAgentKpisPage() {
  const permissions = await resolveGbaFinancePermissions("/glw/finance-agent/kpis");
  return <GbaFinanceWorkspace mode="kpis" permissions={permissions} />;
}
