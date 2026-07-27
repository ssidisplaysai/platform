import { GbaSalesWorkspace } from "@/components/gba/gba-sales-workspace";
import { resolveGbaSalesPermissions } from "../access";

export default async function SalesAgentTimelinePage() {
  const permissions = await resolveGbaSalesPermissions("/glw/sales-agent/timeline");
  return <GbaSalesWorkspace mode="timeline" permissions={permissions} />;
}
