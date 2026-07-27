import { GbaManufacturingWorkspace } from "@/components/gba/gba-manufacturing-workspace";
import { resolveGbaManufacturingPermissions } from "../access";

export default async function ManufacturingAgentHealthPage() {
  const permissions = await resolveGbaManufacturingPermissions("/glw/manufacturing-agent/health");
  return <GbaManufacturingWorkspace mode="health" permissions={permissions} />;
}
