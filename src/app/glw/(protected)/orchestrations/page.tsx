import { GeaOrchestrationWorkspace } from "@/components/gea/gea-orchestration-workspace";
import { resolveGeaOrchestrationPermissions } from "./access";

export default async function OrchestrationActivePage() {
  const permissions = await resolveGeaOrchestrationPermissions("/glw/orchestrations");
  return <GeaOrchestrationWorkspace mode="active" permissions={permissions} />;
}
