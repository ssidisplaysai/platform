import { GeaOrchestrationWorkspace } from "@/components/gea/gea-orchestration-workspace";
import { resolveGeaOrchestrationPermissions } from "../access";

export default async function OrchestrationReplayPage() {
  const permissions = await resolveGeaOrchestrationPermissions("/glw/orchestrations/replay");
  return <GeaOrchestrationWorkspace mode="replay" permissions={permissions} />;
}
