import { GeaWorkspace } from "@/components/gea/gea-workspace";
import { resolveGeaPermissions } from "../access";

export default async function AgentAuditPage() {
  const permissions = await resolveGeaPermissions("/glw/agents/audit");
  return <GeaWorkspace mode="audit" permissions={permissions} />;
}
