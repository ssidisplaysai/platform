import { handleExecutiveDashboard } from "@/lib/gba/executive-api";

export async function GET(request: Request) {
  return handleExecutiveDashboard(request);
}
