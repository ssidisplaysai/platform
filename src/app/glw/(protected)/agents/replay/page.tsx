import { GeaWorkspace } from "@/components/gea/gea-workspace";
import { resolveGeaPermissions } from "../access";

export default async function AgentReplayPage() {
  const permissions = await resolveGeaPermissions("/glw/agents/replay");
  return <GeaWorkspace mode="replay" permissions={permissions} />;
}
