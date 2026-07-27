import { GbaOperationsWorkspace } from "@/components/gba/gba-operations-workspace";
import { resolveGbaOperationsPermissions } from "../access";

export default async function OperationsAgentProductionPage() {
  const permissions = await resolveGbaOperationsPermissions("/glw/operations-agent/production");
  return <GbaOperationsWorkspace mode="production" permissions={permissions} />;
}
