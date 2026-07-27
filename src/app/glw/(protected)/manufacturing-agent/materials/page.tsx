import { GbaManufacturingWorkspace } from "@/components/gba/gba-manufacturing-workspace";
import { resolveGbaManufacturingPermissions } from "../access";

export default async function ManufacturingAgentMaterialsPage() {
  const permissions = await resolveGbaManufacturingPermissions("/glw/manufacturing-agent/materials");
  return <GbaManufacturingWorkspace mode="materials" permissions={permissions} />;
}
