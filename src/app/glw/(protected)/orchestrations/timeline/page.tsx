import { GeaOrchestrationWorkspace } from "@/components/gea/gea-orchestration-workspace";
import { resolveGeaOrchestrationPermissions } from "../access";

export default async function OrchestrationTimelinePage() {
  const permissions = await resolveGeaOrchestrationPermissions("/glw/orchestrations/timeline");
  return <GeaOrchestrationWorkspace mode="timeline" permissions={permissions} />;
}
