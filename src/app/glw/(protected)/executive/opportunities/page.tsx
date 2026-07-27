import { GbaExecutiveWorkspace } from "@/components/gba/gba-executive-workspace";
import { resolveGbaExecutivePermissions } from "../access";

export default async function ExecutiveOpportunitiesPage() {
  const permissions = await resolveGbaExecutivePermissions("/glw/executive/opportunities");
  return <GbaExecutiveWorkspace mode="opportunities" permissions={permissions} />;
}
