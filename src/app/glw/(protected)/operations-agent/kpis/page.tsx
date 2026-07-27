import { GbaOperationsWorkspace } from "@/components/gba/gba-operations-workspace";
import { resolveGbaOperationsPermissions } from "../access";

export default async function OperationsAgentKpisPage() {
  const permissions = await resolveGbaOperationsPermissions("/glw/operations-agent/kpis");
  return <GbaOperationsWorkspace mode="kpis" permissions={permissions} />;
}
