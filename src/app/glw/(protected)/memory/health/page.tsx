import { GeaMemoryWorkspace } from "@/components/gea/gea-memory-workspace";
import { resolveGeaMemoryPermissions } from "../access";

export default async function MemoryHealthPage() {
  const permissions = await resolveGeaMemoryPermissions("/glw/memory/health");
  return <GeaMemoryWorkspace mode="health" permissions={permissions} />;
}
