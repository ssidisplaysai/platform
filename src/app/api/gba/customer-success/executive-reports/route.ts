import { handleCustomerSuccessExecutiveReports } from "@/lib/gba/customer-success-api";

export async function GET(request: Request): Promise<Response> {
  return handleCustomerSuccessExecutiveReports(request);
}
