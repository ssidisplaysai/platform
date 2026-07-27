import { GeaMemoryWorkspace } from "@/components/gea/gea-memory-workspace";
import { resolveGeaMemoryPermissions } from "../access";

export default async function MemoryCachePage() {
  const permissions = await resolveGeaMemoryPermissions("/glw/memory/cache");
  return <GeaMemoryWorkspace mode="cache" permissions={permissions} />;
}
