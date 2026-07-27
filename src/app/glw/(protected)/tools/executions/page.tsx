import { GeaToolWorkspace } from "@/components/gea/gea-tool-workspace";
import { resolveGeaToolPermissions } from "../access";

export default async function ToolExecutionsPage() {
  const permissions = await resolveGeaToolPermissions("/glw/tools/executions");
  return <GeaToolWorkspace mode="executions" permissions={permissions} />;
}
