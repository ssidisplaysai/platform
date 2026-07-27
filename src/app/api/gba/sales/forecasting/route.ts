import { handleSalesForecasting } from "@/lib/gba/sales-api";

export async function GET(request: Request) {
  return handleSalesForecasting(request);
}
