import { GeaWorkspace } from "@/components/gea/gea-workspace";
import { resolveGeaPermissions } from "./access";

export default async function AgentsPage() {
  const permissions = await resolveGeaPermissions("/glw/agents");
  return <GeaWorkspace mode="agents" permissions={permissions} />;
}
