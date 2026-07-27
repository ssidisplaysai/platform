import { GeaOrchestrationWorkspace } from "@/components/gea/gea-orchestration-workspace";
import { resolveGeaOrchestrationPermissions } from "../access";

export default async function OrchestrationApprovalsPage() {
  const permissions = await resolveGeaOrchestrationPermissions("/glw/orchestrations/approvals");
  return <GeaOrchestrationWorkspace mode="approvals" permissions={permissions} />;
}
