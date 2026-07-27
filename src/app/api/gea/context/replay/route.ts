import { handleContextReplay } from "@/lib/gea/memory-api";

export async function POST(request: Request) {
  return handleContextReplay(request);
}
