import { handleSalesHealth } from "@/lib/gba/sales-api";

export async function GET(request: Request) {
  return handleSalesHealth(request);
}
