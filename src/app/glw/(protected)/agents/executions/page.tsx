import { GeaWorkspace } from "@/components/gea/gea-workspace";
import { resolveGeaPermissions } from "../access";

export default async function AgentExecutionsPage() {
  const permissions = await resolveGeaPermissions("/glw/agents/executions");
  return <GeaWorkspace mode="executions" permissions={permissions} />;
}
