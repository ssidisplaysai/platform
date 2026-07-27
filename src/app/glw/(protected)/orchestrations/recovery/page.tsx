import { GeaOrchestrationWorkspace } from "@/components/gea/gea-orchestration-workspace";
import { resolveGeaOrchestrationPermissions } from "../access";

export default async function OrchestrationRecoveryPage() {
  const permissions = await resolveGeaOrchestrationPermissions("/glw/orchestrations/recovery");
  return <GeaOrchestrationWorkspace mode="recovery" permissions={permissions} />;
}
