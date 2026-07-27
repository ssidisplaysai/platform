import { GeaToolWorkspace } from "@/components/gea/gea-tool-workspace";
import { resolveGeaToolPermissions } from "./access";

export default async function ToolCatalogPage() {
  const permissions = await resolveGeaToolPermissions("/glw/tools");
  return <GeaToolWorkspace mode="catalog" permissions={permissions} />;
}
