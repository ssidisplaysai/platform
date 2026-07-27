import { GbaManufacturingWorkspace } from "@/components/gba/gba-manufacturing-workspace";
import { resolveGbaManufacturingPermissions } from "../access";

export default async function ManufacturingAgentProductionOrdersPage() {
  const permissions = await resolveGbaManufacturingPermissions("/glw/manufacturing-agent/production-orders");
  return <GbaManufacturingWorkspace mode="production-orders" permissions={permissions} />;
}
