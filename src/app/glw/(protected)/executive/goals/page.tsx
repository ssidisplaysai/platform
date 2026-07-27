import { GbaExecutiveWorkspace } from "@/components/gba/gba-executive-workspace";
import { resolveGbaExecutivePermissions } from "../access";

export default async function ExecutiveGoalsPage() {
  const permissions = await resolveGbaExecutivePermissions("/glw/executive/goals");
  return <GbaExecutiveWorkspace mode="goals" permissions={permissions} />;
}
