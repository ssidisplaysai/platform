import { handleCustomerSuccessDashboard } from "@/lib/gba/customer-success-api";

export async function GET(request: Request): Promise<Response> {
  return handleCustomerSuccessDashboard(request);
}
