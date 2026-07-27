import { GeaWorkspace } from "@/components/gea/gea-workspace";
import { resolveGeaPermissions } from "../access";

export default async function AgentCapabilitiesPage() {
  const permissions = await resolveGeaPermissions("/glw/agents/capabilities");
  return <GeaWorkspace mode="capabilities" permissions={permissions} />;
}
