import { handleContextHealth } from "@/lib/gea/memory-api";

export async function GET(request: Request) {
  return handleContextHealth(request);
}
