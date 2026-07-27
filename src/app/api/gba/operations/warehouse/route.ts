import { handleOperationsWarehouse } from "@/lib/gba/operations-api";

export async function GET(request: Request) {
  return handleOperationsWarehouse(request);
}
