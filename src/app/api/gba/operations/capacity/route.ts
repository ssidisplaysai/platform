import { handleOperationsCapacity } from "@/lib/gba/operations-api";

export async function GET(request: Request) {
  return handleOperationsCapacity(request);
}
