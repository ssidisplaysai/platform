import { GbaManufacturingWorkspace } from "@/components/gba/gba-manufacturing-workspace";
import { resolveGbaManufacturingPermissions } from "../access";

export default async function ManufacturingAgentTimelinePage() {
  const permissions = await resolveGbaManufacturingPermissions("/glw/manufacturing-agent/timeline");
  return <GbaManufacturingWorkspace mode="timeline" permissions={permissions} />;
}
