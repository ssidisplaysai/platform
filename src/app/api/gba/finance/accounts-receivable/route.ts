import { handleFinanceAccountsReceivable } from "@/lib/gba/finance-api";

export async function GET(request: Request): Promise<Response> {
  return handleFinanceAccountsReceivable(request);
}
