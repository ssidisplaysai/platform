import { GbaOperationsWorkspace } from "@/components/gba/gba-operations-workspace";
import { resolveGbaOperationsPermissions } from "../access";

export default async function OperationsAgentWorkOrdersPage() {
  const permissions = await resolveGbaOperationsPermissions("/glw/operations-agent/work-orders");
  return <GbaOperationsWorkspace mode="work-orders" permissions={permissions} />;
}
