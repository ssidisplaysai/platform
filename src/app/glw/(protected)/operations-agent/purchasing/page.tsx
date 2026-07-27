import { GbaOperationsWorkspace } from "@/components/gba/gba-operations-workspace";
import { resolveGbaOperationsPermissions } from "../access";

export default async function OperationsAgentPurchasingPage() {
  const permissions = await resolveGbaOperationsPermissions("/glw/operations-agent/purchasing");
  return <GbaOperationsWorkspace mode="purchasing" permissions={permissions} />;
}
