import { GbaManufacturingWorkspace } from "@/components/gba/gba-manufacturing-workspace";
import { resolveGbaManufacturingPermissions } from "./access";

export default async function ManufacturingAgentDashboardPage() {
  const permissions = await resolveGbaManufacturingPermissions("/glw/manufacturing-agent");
  return <GbaManufacturingWorkspace mode="dashboard" permissions={permissions} />;
}
