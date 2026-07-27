import { handleContextProvenance } from "@/lib/gea/memory-api";

export async function GET(request: Request) {
  return handleContextProvenance(request);
}
