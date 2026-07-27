import { GbaOperationsWorkspace } from "@/components/gba/gba-operations-workspace";
import { resolveGbaOperationsPermissions } from "../access";

export default async function OperationsAgentWarehousePage() {
  const permissions = await resolveGbaOperationsPermissions("/glw/operations-agent/warehouse");
  return <GbaOperationsWorkspace mode="warehouse" permissions={permissions} />;
}
