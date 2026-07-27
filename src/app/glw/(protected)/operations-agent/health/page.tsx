import { GbaOperationsWorkspace } from "@/components/gba/gba-operations-workspace";
import { resolveGbaOperationsPermissions } from "../access";

export default async function OperationsAgentHealthPage() {
  const permissions = await resolveGbaOperationsPermissions("/glw/operations-agent/health");
  return <GbaOperationsWorkspace mode="health" permissions={permissions} />;
}
