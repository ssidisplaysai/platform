import { GbaExecutiveWorkspace } from "@/components/gba/gba-executive-workspace";
import { resolveGbaExecutivePermissions } from "../access";

export default async function ExecutiveBriefingsPage() {
  const permissions = await resolveGbaExecutivePermissions("/glw/executive/briefings");
  return <GbaExecutiveWorkspace mode="briefings" permissions={permissions} />;
}
