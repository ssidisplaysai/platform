import { GeaWorkspace } from "@/components/gea/gea-workspace";
import { resolveGeaPermissions } from "../access";

export default async function AgentContextPage() {
  const permissions = await resolveGeaPermissions("/glw/agents/context");
  return <GeaWorkspace mode="context" permissions={permissions} />;
}
