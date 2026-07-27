import { GbaExecutiveWorkspace } from "@/components/gba/gba-executive-workspace";
import { resolveGbaExecutivePermissions } from "../access";

export default async function ExecutiveRisksPage() {
  const permissions = await resolveGbaExecutivePermissions("/glw/executive/risks");
  return <GbaExecutiveWorkspace mode="risks" permissions={permissions} />;
}
