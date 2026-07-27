import { GbaFinanceWorkspace } from "@/components/gba/gba-finance-workspace";
import { resolveGbaFinancePermissions } from "./access";

export default async function FinanceAgentDashboardPage() {
  const permissions = await resolveGbaFinancePermissions("/glw/finance-agent");
  return <GbaFinanceWorkspace mode="dashboard" permissions={permissions} />;
}
