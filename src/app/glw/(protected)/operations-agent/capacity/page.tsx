import { GbaOperationsWorkspace } from "@/components/gba/gba-operations-workspace";
import { resolveGbaOperationsPermissions } from "../access";

export default async function OperationsAgentCapacityPage() {
  const permissions = await resolveGbaOperationsPermissions("/glw/operations-agent/capacity");
  return <GbaOperationsWorkspace mode="capacity" permissions={permissions} />;
}
