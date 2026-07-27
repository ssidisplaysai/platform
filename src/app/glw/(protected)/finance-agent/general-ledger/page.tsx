import { GbaFinanceWorkspace } from "@/components/gba/gba-finance-workspace";
import { resolveGbaFinancePermissions } from "../access";

export default async function FinanceAgentGeneralLedgerPage() {
  const permissions = await resolveGbaFinancePermissions("/glw/finance-agent/general-ledger");
  return <GbaFinanceWorkspace mode="general-ledger" permissions={permissions} />;
}
