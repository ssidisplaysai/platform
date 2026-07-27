import { GeaMemoryWorkspace } from "@/components/gea/gea-memory-workspace";
import { resolveGeaMemoryPermissions } from "../access";

export default async function MemoryPoliciesPage() {
  const permissions = await resolveGeaMemoryPermissions("/glw/memory/policies");
  return <GeaMemoryWorkspace mode="policies" permissions={permissions} />;
}
