import { handleContext } from "@/lib/gea/memory-api";

export async function GET(request: Request) {
  return handleContext(request);
}
