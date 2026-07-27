import { GbaSalesWorkspace } from "@/components/gba/gba-sales-workspace";
import { resolveGbaSalesPermissions } from "../access";

export default async function SalesAgentHealthPage() {
  const permissions = await resolveGbaSalesPermissions("/glw/sales-agent/health");
  return <GbaSalesWorkspace mode="health" permissions={permissions} />;
}
