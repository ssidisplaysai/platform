import { GbaManufacturingWorkspace } from "@/components/gba/gba-manufacturing-workspace";
import { resolveGbaManufacturingPermissions } from "../access";

export default async function ManufacturingAgentCostingPage() {
  const permissions = await resolveGbaManufacturingPermissions("/glw/manufacturing-agent/costing");
  return <GbaManufacturingWorkspace mode="costing" permissions={permissions} />;
}
