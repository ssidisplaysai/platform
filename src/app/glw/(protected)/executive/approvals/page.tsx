import { GbaExecutiveWorkspace } from "@/components/gba/gba-executive-workspace";
import { resolveGbaExecutivePermissions } from "../access";

export default async function ExecutiveApprovalsPage() {
  const permissions = await resolveGbaExecutivePermissions("/glw/executive/approvals");
  return <GbaExecutiveWorkspace mode="approvals" permissions={permissions} />;
}
