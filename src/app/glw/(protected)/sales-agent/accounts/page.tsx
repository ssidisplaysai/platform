import { GbaSalesWorkspace } from "@/components/gba/gba-sales-workspace";
import { resolveGbaSalesPermissions } from "../access";

export default async function SalesAgentAccountsPage() {
  const permissions = await resolveGbaSalesPermissions("/glw/sales-agent/accounts");
  return <GbaSalesWorkspace mode="accounts" permissions={permissions} />;
}
