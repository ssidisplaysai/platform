import { handleContextVersions } from "@/lib/gea/memory-api";

export async function GET(request: Request) {
  return handleContextVersions(request);
}
