import { GbaManufacturingWorkspace } from "@/components/gba/gba-manufacturing-workspace";
import { resolveGbaManufacturingPermissions } from "../access";

export default async function ManufacturingAgentLaborPage() {
  const permissions = await resolveGbaManufacturingPermissions("/glw/manufacturing-agent/labor");
  return <GbaManufacturingWorkspace mode="labor" permissions={permissions} />;
}
