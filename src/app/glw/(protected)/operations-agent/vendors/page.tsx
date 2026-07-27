import { GbaOperationsWorkspace } from "@/components/gba/gba-operations-workspace";
import { resolveGbaOperationsPermissions } from "../access";

export default async function OperationsAgentVendorsPage() {
  const permissions = await resolveGbaOperationsPermissions("/glw/operations-agent/vendors");
  return <GbaOperationsWorkspace mode="vendors" permissions={permissions} />;
}
