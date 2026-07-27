import { GbaFinanceWorkspace } from "@/components/gba/gba-finance-workspace";
import { resolveGbaFinancePermissions } from "../access";

export default async function FinanceAgentAccountsReceivablePage() {
  const permissions = await resolveGbaFinancePermissions("/glw/finance-agent/accounts-receivable");
  return <GbaFinanceWorkspace mode="accounts-receivable" permissions={permissions} />;
}
