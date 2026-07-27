import { handleOperationsShipping } from "@/lib/gba/operations-api";

export async function GET(request: Request) {
  return handleOperationsShipping(request);
}
