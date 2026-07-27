import { handleFinanceExecutiveReports } from "@/lib/gba/finance-api";

export async function GET(request: Request): Promise<Response> {
  return handleFinanceExecutiveReports(request);
}
