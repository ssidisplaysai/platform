import { GbaFinanceWorkspace } from "@/components/gba/gba-finance-workspace";
import { resolveGbaFinancePermissions } from "../access";

export default async function FinanceAgentAccountsPayablePage() {
  const permissions = await resolveGbaFinancePermissions("/glw/finance-agent/accounts-payable");
  return <GbaFinanceWorkspace mode="accounts-payable" permissions={permissions} />;
}
