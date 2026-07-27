import { GeaWorkspace } from "@/components/gea/gea-workspace";
import { resolveGeaPermissions } from "../access";

export default async function AgentPlansPage() {
  const permissions = await resolveGeaPermissions("/glw/agents/plans");
  return <GeaWorkspace mode="plans" permissions={permissions} />;
}
