import { GeaWorkspace } from "@/components/gea/gea-workspace";
import { resolveGeaPermissions } from "../access";

export default async function AgentHealthPage() {
  const permissions = await resolveGeaPermissions("/glw/agents/health");
  return <GeaWorkspace mode="health" permissions={permissions} />;
}
