import { GeaOrchestrationWorkspace } from "@/components/gea/gea-orchestration-workspace";
import { resolveGeaOrchestrationPermissions } from "../access";

export default async function OrchestrationHealthPage() {
  const permissions = await resolveGeaOrchestrationPermissions("/glw/orchestrations/health");
  return <GeaOrchestrationWorkspace mode="health" permissions={permissions} />;
}
