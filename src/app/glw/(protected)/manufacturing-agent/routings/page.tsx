import { GbaManufacturingWorkspace } from "@/components/gba/gba-manufacturing-workspace";
import { resolveGbaManufacturingPermissions } from "../access";

export default async function ManufacturingAgentRoutingsPage() {
  const permissions = await resolveGbaManufacturingPermissions("/glw/manufacturing-agent/routings");
  return <GbaManufacturingWorkspace mode="routings" permissions={permissions} />;
}
