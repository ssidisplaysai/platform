import { GbaOperationsWorkspace } from "@/components/gba/gba-operations-workspace";
import { resolveGbaOperationsPermissions } from "./access";

export default async function OperationsAgentDashboardPage() {
  const permissions = await resolveGbaOperationsPermissions("/glw/operations-agent");
  return <GbaOperationsWorkspace mode="dashboard" permissions={permissions} />;
}
