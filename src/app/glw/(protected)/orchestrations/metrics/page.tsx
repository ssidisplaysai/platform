import { GeaOrchestrationWorkspace } from "@/components/gea/gea-orchestration-workspace";
import { resolveGeaOrchestrationPermissions } from "../access";

export default async function OrchestrationMetricsPage() {
  const permissions = await resolveGeaOrchestrationPermissions("/glw/orchestrations/metrics");
  return <GeaOrchestrationWorkspace mode="metrics" permissions={permissions} />;
}
