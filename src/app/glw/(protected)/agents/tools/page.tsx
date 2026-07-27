import { GeaWorkspace } from "@/components/gea/gea-workspace";
import { resolveGeaPermissions } from "../access";

export default async function AgentToolsPage() {
  const permissions = await resolveGeaPermissions("/glw/agents/tools");
  return <GeaWorkspace mode="tools" permissions={permissions} />;
}
