import { GbaFinanceWorkspace } from "@/components/gba/gba-finance-workspace";
import { resolveGbaFinancePermissions } from "../access";

export default async function FinanceAgentHealthPage() {
  const permissions = await resolveGbaFinancePermissions("/glw/finance-agent/health");
  return <GbaFinanceWorkspace mode="health" permissions={permissions} />;
}
