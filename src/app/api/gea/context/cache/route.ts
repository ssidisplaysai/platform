import { handleContextCache } from "@/lib/gea/memory-api";

export async function GET(request: Request) {
  return handleContextCache(request);
}
