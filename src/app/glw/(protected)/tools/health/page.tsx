import { GeaToolWorkspace } from "@/components/gea/gea-tool-workspace";
import { resolveGeaToolPermissions } from "../access";

export default async function ToolHealthPage() {
  const permissions = await resolveGeaToolPermissions("/glw/tools/health");
  return <GeaToolWorkspace mode="health" permissions={permissions} />;
}
