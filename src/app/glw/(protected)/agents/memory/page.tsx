import { GeaWorkspace } from "@/components/gea/gea-workspace";
import { resolveGeaPermissions } from "../access";

export default async function AgentMemoryPage() {
  const permissions = await resolveGeaPermissions("/glw/agents/memory");
  return <GeaWorkspace mode="memory" permissions={permissions} />;
}
