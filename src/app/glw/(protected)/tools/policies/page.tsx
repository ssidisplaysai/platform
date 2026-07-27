import { GeaToolWorkspace } from "@/components/gea/gea-tool-workspace";
import { resolveGeaToolPermissions } from "../access";

export default async function ToolPoliciesPage() {
  const permissions = await resolveGeaToolPermissions("/glw/tools/policies");
  return <GeaToolWorkspace mode="policies" permissions={permissions} />;
}
