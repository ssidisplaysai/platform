import { GbaManufacturingWorkspace } from "@/components/gba/gba-manufacturing-workspace";
import { resolveGbaManufacturingPermissions } from "../access";

export default async function ManufacturingAgentBomsPage() {
  const permissions = await resolveGbaManufacturingPermissions("/glw/manufacturing-agent/boms");
  return <GbaManufacturingWorkspace mode="boms" permissions={permissions} />;
}
