import { handleOperationsInventory } from "@/lib/gba/operations-api";

export async function GET(request: Request) {
  return handleOperationsInventory(request);
}
