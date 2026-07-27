import { GeaToolWorkspace } from "@/components/gea/gea-tool-workspace";
import { resolveGeaToolPermissions } from "../access";

export default async function ToolVersionsPage() {
  const permissions = await resolveGeaToolPermissions("/glw/tools/versions");
  return <GeaToolWorkspace mode="versions" permissions={permissions} />;
}
