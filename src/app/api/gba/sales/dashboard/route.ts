import { handleSalesDashboard } from "@/lib/gba/sales-api";

export async function GET(request: Request) {
  return handleSalesDashboard(request);
}
