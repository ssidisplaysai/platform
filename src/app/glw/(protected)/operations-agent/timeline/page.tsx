import { GbaOperationsWorkspace } from "@/components/gba/gba-operations-workspace";
import { resolveGbaOperationsPermissions } from "../access";

export default async function OperationsAgentTimelinePage() {
  const permissions = await resolveGbaOperationsPermissions("/glw/operations-agent/timeline");
  return <GbaOperationsWorkspace mode="timeline" permissions={permissions} />;
}
