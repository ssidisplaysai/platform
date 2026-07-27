import { GeaOrchestrationWorkspace } from "@/components/gea/gea-orchestration-workspace";
import { resolveGeaOrchestrationPermissions } from "../access";

export default async function OrchestrationDefinitionsPage() {
  const permissions = await resolveGeaOrchestrationPermissions("/glw/orchestrations/definitions");
  return <GeaOrchestrationWorkspace mode="definitions" permissions={permissions} />;
}
