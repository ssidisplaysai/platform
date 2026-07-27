import { GbaOperationsWorkspace } from "@/components/gba/gba-operations-workspace";
import { resolveGbaOperationsPermissions } from "../access";

export default async function OperationsAgentInventoryPage() {
  const permissions = await resolveGbaOperationsPermissions("/glw/operations-agent/inventory");
  return <GbaOperationsWorkspace mode="inventory" permissions={permissions} />;
}
