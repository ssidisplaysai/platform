import { GbaExecutiveWorkspace } from "@/components/gba/gba-executive-workspace";
import { resolveGbaExecutivePermissions } from "../access";

export default async function ExecutiveTimelinePage() {
  const permissions = await resolveGbaExecutivePermissions("/glw/executive/timeline");
  return <GbaExecutiveWorkspace mode="timeline" permissions={permissions} />;
}
