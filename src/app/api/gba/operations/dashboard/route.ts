import { handleOperationsDashboard } from "@/lib/gba/operations-api";

export async function GET(request: Request) {
  return handleOperationsDashboard(request);
}
