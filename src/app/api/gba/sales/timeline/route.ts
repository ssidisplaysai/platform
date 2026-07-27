import { handleSalesTimeline } from "@/lib/gba/sales-api";

export async function GET(request: Request) {
  return handleSalesTimeline(request);
}
