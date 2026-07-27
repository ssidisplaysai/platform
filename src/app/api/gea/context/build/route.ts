import { handleContextBuild } from "@/lib/gea/memory-api";

export async function POST(request: Request) {
  return handleContextBuild(request);
}
