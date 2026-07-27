import { GbaExecutiveWorkspace } from "@/components/gba/gba-executive-workspace";
import { resolveGbaExecutivePermissions } from "./access";

export default async function ExecutiveDashboardPage() {
  const permissions = await resolveGbaExecutivePermissions("/glw/executive");
  return <GbaExecutiveWorkspace mode="dashboard" permissions={permissions} />;
}
