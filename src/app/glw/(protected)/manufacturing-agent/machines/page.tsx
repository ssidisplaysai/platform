import { GbaManufacturingWorkspace } from "@/components/gba/gba-manufacturing-workspace";
import { resolveGbaManufacturingPermissions } from "../access";

export default async function ManufacturingAgentMachinesPage() {
  const permissions = await resolveGbaManufacturingPermissions("/glw/manufacturing-agent/machines");
  return <GbaManufacturingWorkspace mode="machines" permissions={permissions} />;
}
