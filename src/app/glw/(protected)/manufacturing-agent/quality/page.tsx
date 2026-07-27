import { GbaManufacturingWorkspace } from "@/components/gba/gba-manufacturing-workspace";
import { resolveGbaManufacturingPermissions } from "../access";

export default async function ManufacturingAgentQualityPage() {
  const permissions = await resolveGbaManufacturingPermissions("/glw/manufacturing-agent/quality");
  return <GbaManufacturingWorkspace mode="quality" permissions={permissions} />;
}
