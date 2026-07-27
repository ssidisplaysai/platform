import { GeaToolWorkspace } from "@/components/gea/gea-tool-workspace";
import { resolveGeaToolPermissions } from "../access";

export default async function ToolCategoriesPage() {
  const permissions = await resolveGeaToolPermissions("/glw/tools/categories");
  return <GeaToolWorkspace mode="categories" permissions={permissions} />;
}
