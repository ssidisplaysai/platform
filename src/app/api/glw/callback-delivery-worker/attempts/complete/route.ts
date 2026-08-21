import { handleGlwProducerWorkerCommand } from "@/lib/glw/producer-worker-api-handler";

export async function POST(request: Request) {
  return handleGlwProducerWorkerCommand(request, "COMPLETE_ATTEMPT");
}