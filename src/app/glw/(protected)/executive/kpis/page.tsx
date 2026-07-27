import { GbaExecutiveWorkspace } from "@/components/gba/gba-executive-workspace";
import { resolveGbaExecutivePermissions } from "../access";

export default async function ExecutiveKpisPage() {
  const permissions = await resolveGbaExecutivePermissions("/glw/executive/kpis");
  return <GbaExecutiveWorkspace mode="kpis" permissions={permissions} />;
}
