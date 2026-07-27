import { GbaSalesWorkspace } from "@/components/gba/gba-sales-workspace";
import { resolveGbaSalesPermissions } from "./access";

export default async function SalesAgentDashboardPage() {
  const permissions = await resolveGbaSalesPermissions("/glw/sales-agent");
  return <GbaSalesWorkspace mode="dashboard" permissions={permissions} />;
}
