import { GbaManufacturingWorkspace } from "@/components/gba/gba-manufacturing-workspace";
import { resolveGbaManufacturingPermissions } from "../access";

export default async function ManufacturingAgentKpisPage() {
  const permissions = await resolveGbaManufacturingPermissions("/glw/manufacturing-agent/kpis");
  return <GbaManufacturingWorkspace mode="kpis" permissions={permissions} />;
}
