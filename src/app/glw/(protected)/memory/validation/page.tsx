import { GeaMemoryWorkspace } from "@/components/gea/gea-memory-workspace";
import { resolveGeaMemoryPermissions } from "../access";

export default async function MemoryValidationPage() {
  const permissions = await resolveGeaMemoryPermissions("/glw/memory/validation");
  return <GeaMemoryWorkspace mode="validation" permissions={permissions} />;
}
