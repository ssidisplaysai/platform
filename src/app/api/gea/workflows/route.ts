import { handleWorkflows } from "@/lib/gea/orchestration-api";

export async function GET(request: Request) {
  return handleWorkflows(request);
}
