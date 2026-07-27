import { GopOperationsCenter } from "@/components/gop/gop-operations-center";
import { getGenesisOrchestrationRuntime } from "@/platform/gop/runtime/orchestration-runtime";
import { getGenesisEventStore } from "@/platform/gop/runtime/event-store";

const GLW_WORKSPACE_ID = "glw-led-display-warehouse";

export default async function GlwOperationsPage() {
  const runtime = getGenesisOrchestrationRuntime();
  const initialSnapshot = await runtime.buildOperationsSnapshot(GLW_WORKSPACE_ID, getGenesisEventStore());

  return <GopOperationsCenter initialSnapshot={initialSnapshot} />;
}
