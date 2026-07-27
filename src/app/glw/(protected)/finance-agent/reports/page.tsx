import { GbaFinanceWorkspace } from "@/components/gba/gba-finance-workspace";
import { resolveGbaFinancePermissions } from "../access";

export default async function FinanceAgentReportsPage() {
  const permissions = await resolveGbaFinancePermissions("/glw/finance-agent/reports");
  return <GbaFinanceWorkspace mode="reports" permissions={permissions} />;
}
