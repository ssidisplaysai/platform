import { GbaManufacturingWorkspace } from "@/components/gba/gba-manufacturing-workspace";
import { resolveGbaManufacturingPermissions } from "../access";

export default async function ManufacturingAgentRecommendationsPage() {
  const permissions = await resolveGbaManufacturingPermissions("/glw/manufacturing-agent/recommendations");
  return <GbaManufacturingWorkspace mode="recommendations" permissions={permissions} />;
}
