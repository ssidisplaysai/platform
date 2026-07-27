import { handleContextValidation } from "@/lib/gea/memory-api";

export async function GET(request: Request) {
  return handleContextValidation(request);
}
