import { GeaMemoryWorkspace } from "@/components/gea/gea-memory-workspace";
import { resolveGeaMemoryPermissions } from "../access";

export default async function MemoryProvenancePage() {
  const permissions = await resolveGeaMemoryPermissions("/glw/memory/provenance");
  return <GeaMemoryWorkspace mode="provenance" permissions={permissions} />;
}
