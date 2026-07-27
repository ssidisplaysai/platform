import { GbaOperationsWorkspace } from "@/components/gba/gba-operations-workspace";
import { resolveGbaOperationsPermissions } from "../access";

export default async function OperationsAgentShippingPage() {
  const permissions = await resolveGbaOperationsPermissions("/glw/operations-agent/shipping");
  return <GbaOperationsWorkspace mode="shipping" permissions={permissions} />;
}
