import { GbaSalesWorkspace } from "@/components/gba/gba-sales-workspace";
import { resolveGbaSalesPermissions } from "../access";

export default async function SalesAgentPipelinePage() {
  const permissions = await resolveGbaSalesPermissions("/glw/sales-agent/pipeline");
  return <GbaSalesWorkspace mode="pipeline" permissions={permissions} />;
}
