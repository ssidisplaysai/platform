import { GeaToolWorkspace } from "@/components/gea/gea-tool-workspace";
import { resolveGeaToolPermissions } from "../access";

export default async function ToolValidationPage() {
  const permissions = await resolveGeaToolPermissions("/glw/tools/validation");
  return <GeaToolWorkspace mode="validation" permissions={permissions} />;
}
