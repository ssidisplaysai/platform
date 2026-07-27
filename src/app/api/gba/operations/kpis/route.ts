import { handleOperationsKpis } from "@/lib/gba/operations-api";

export async function GET(request: Request) {
  return handleOperationsKpis(request);
}
