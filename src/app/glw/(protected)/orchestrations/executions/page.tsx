import { GeaOrchestrationWorkspace } from "@/components/gea/gea-orchestration-workspace";
import { resolveGeaOrchestrationPermissions } from "../access";

export default async function OrchestrationExecutionsPage() {
  const permissions = await resolveGeaOrchestrationPermissions("/glw/orchestrations/executions");
  return <GeaOrchestrationWorkspace mode="executions" permissions={permissions} />;
}
