import { handleCustomerSuccessRenewals } from "@/lib/gba/customer-success-api";

export async function GET(request: Request): Promise<Response> {
  return handleCustomerSuccessRenewals(request);
}
