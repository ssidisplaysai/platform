import { GeaWorkspace } from "@/components/gea/gea-workspace";
import { resolveGeaPermissions } from "../access";

export default async function AgentTimelinePage() {
  const permissions = await resolveGeaPermissions("/glw/agents/timeline");
  return <GeaWorkspace mode="timeline" permissions={permissions} />;
}
