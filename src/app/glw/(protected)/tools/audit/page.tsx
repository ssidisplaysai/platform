import { GeaToolWorkspace } from "@/components/gea/gea-tool-workspace";
import { resolveGeaToolPermissions } from "../access";

export default async function ToolAuditPage() {
  const permissions = await resolveGeaToolPermissions("/glw/tools/audit");
  return <GeaToolWorkspace mode="audit" permissions={permissions} />;
}
