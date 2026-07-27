import { GeaWorkspace } from "@/components/gea/gea-workspace";
import { resolveGeaPermissions } from "../access";

export default async function AgentApprovalsPage() {
  const permissions = await resolveGeaPermissions("/glw/agents/approvals");
  return <GeaWorkspace mode="approvals" permissions={permissions} />;
}
