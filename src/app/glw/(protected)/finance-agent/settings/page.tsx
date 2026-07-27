import { GbaFinanceWorkspace } from "@/components/gba/gba-finance-workspace";
import { resolveGbaFinancePermissions } from "../access";

export default async function FinanceAgentSettingsPage() {
  const permissions = await resolveGbaFinancePermissions("/glw/finance-agent/settings");
  return <GbaFinanceWorkspace mode="settings" permissions={permissions} />;
}
