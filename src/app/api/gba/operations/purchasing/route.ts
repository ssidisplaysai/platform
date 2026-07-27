import { handleOperationsPurchasing } from "@/lib/gba/operations-api";

export async function GET(request: Request) {
  return handleOperationsPurchasing(request);
}
