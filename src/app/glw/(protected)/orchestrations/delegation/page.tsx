import { GeaOrchestrationWorkspace } from "@/components/gea/gea-orchestration-workspace";
import { resolveGeaOrchestrationPermissions } from "../access";

export default async function OrchestrationDelegationPage() {
  const permissions = await resolveGeaOrchestrationPermissions("/glw/orchestrations/delegation");
  return <GeaOrchestrationWorkspace mode="delegation" permissions={permissions} />;
}
