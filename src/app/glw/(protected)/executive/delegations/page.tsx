import { GbaExecutiveWorkspace } from "@/components/gba/gba-executive-workspace";
import { resolveGbaExecutivePermissions } from "../access";

export default async function ExecutiveDelegationsPage() {
  const permissions = await resolveGbaExecutivePermissions("/glw/executive/delegations");
  return <GbaExecutiveWorkspace mode="delegations" permissions={permissions} />;
}
