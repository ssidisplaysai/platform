import { GbaFinanceWorkspace } from "@/components/gba/gba-finance-workspace";
import { resolveGbaFinancePermissions } from "../access";

export default async function FinanceAgentBudgetsPage() {
  const permissions = await resolveGbaFinancePermissions("/glw/finance-agent/budgets");
  return <GbaFinanceWorkspace mode="budgets" permissions={permissions} />;
}
