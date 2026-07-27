import { GbaExecutiveWorkspace } from "@/components/gba/gba-executive-workspace";
import { resolveGbaExecutivePermissions } from "../access";

export default async function ExecutiveRecommendationsPage() {
  const permissions = await resolveGbaExecutivePermissions("/glw/executive/recommendations");
  return <GbaExecutiveWorkspace mode="recommendations" permissions={permissions} />;
}
