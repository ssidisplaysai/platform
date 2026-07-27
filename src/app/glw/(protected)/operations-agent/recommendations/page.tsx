import { GbaOperationsWorkspace } from "@/components/gba/gba-operations-workspace";
import { resolveGbaOperationsPermissions } from "../access";

export default async function OperationsAgentRecommendationsPage() {
  const permissions = await resolveGbaOperationsPermissions("/glw/operations-agent/recommendations");
  return <GbaOperationsWorkspace mode="recommendations" permissions={permissions} />;
}
