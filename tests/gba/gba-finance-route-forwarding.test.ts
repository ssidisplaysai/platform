import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/gba/finance-api", () => ({
  handleFinanceDashboard: jest.fn(async () => Response.json({ ok: true })),
  handleFinanceGeneralLedger: jest.fn(async () => Response.json({ ok: true })),
  handleFinanceAccountsReceivable: jest.fn(async () => Response.json({ ok: true })),
  handleFinanceAccountsPayable: jest.fn(async () => Response.json({ ok: true })),
  handleFinanceBudgets: jest.fn(async () => Response.json({ ok: true })),
  handleFinanceProfitability: jest.fn(async () => Response.json({ ok: true })),
  handleFinanceForecasts: jest.fn(async () => Response.json({ ok: true })),
  handleFinanceKpis: jest.fn(async () => Response.json({ ok: true })),
  handleFinanceRecommendations: jest.fn(async () => Response.json({ ok: true })),
  handleReviewFinanceRecommendation: jest.fn(async () => Response.json({ ok: true })),
  handleFinanceExecutiveReports: jest.fn(async () => Response.json({ ok: true })),
  handleFinanceHealth: jest.fn(async () => Response.json({ ok: true })),
}));

import { GET as getDashboardRoute } from "@/app/api/gba/finance/dashboard/route";
import { GET as getGeneralLedgerRoute } from "@/app/api/gba/finance/general-ledger/route";
import { GET as getReceivablesRoute } from "@/app/api/gba/finance/accounts-receivable/route";
import { GET as getPayablesRoute } from "@/app/api/gba/finance/accounts-payable/route";
import { GET as getBudgetsRoute } from "@/app/api/gba/finance/budgets/route";
import { GET as getProfitabilityRoute } from "@/app/api/gba/finance/profitability/route";
import { GET as getForecastsRoute } from "@/app/api/gba/finance/forecasts/route";
import { GET as getKpisRoute } from "@/app/api/gba/finance/kpis/route";
import { GET as getRecommendationsRoute } from "@/app/api/gba/finance/recommendations/route";
import { POST as postReviewRoute } from "@/app/api/gba/finance/recommendations/review/route";
import { GET as getReportsRoute } from "@/app/api/gba/finance/executive-reports/route";
import { GET as getHealthRoute } from "@/app/api/gba/finance/health/route";

import {
  handleFinanceAccountsPayable,
  handleFinanceAccountsReceivable,
  handleFinanceBudgets,
  handleFinanceDashboard,
  handleFinanceExecutiveReports,
  handleFinanceForecasts,
  handleFinanceGeneralLedger,
  handleFinanceHealth,
  handleFinanceKpis,
  handleFinanceProfitability,
  handleFinanceRecommendations,
  handleReviewFinanceRecommendation,
} from "@/lib/gba/finance-api";

describe("gba finance route forwarding", () => {
  it("forwards gba finance api routes", async () => {
    await getDashboardRoute(new Request("http://localhost/api/gba/finance/dashboard"));
    await getGeneralLedgerRoute(new Request("http://localhost/api/gba/finance/general-ledger"));
    await getReceivablesRoute(new Request("http://localhost/api/gba/finance/accounts-receivable"));
    await getPayablesRoute(new Request("http://localhost/api/gba/finance/accounts-payable"));
    await getBudgetsRoute(new Request("http://localhost/api/gba/finance/budgets"));
    await getProfitabilityRoute(new Request("http://localhost/api/gba/finance/profitability"));
    await getForecastsRoute(new Request("http://localhost/api/gba/finance/forecasts"));
    await getKpisRoute(new Request("http://localhost/api/gba/finance/kpis"));
    await getRecommendationsRoute(new Request("http://localhost/api/gba/finance/recommendations"));
    await postReviewRoute(new Request("http://localhost/api/gba/finance/recommendations/review", { method: "POST" }));
    await getReportsRoute(new Request("http://localhost/api/gba/finance/executive-reports"));
    await getHealthRoute(new Request("http://localhost/api/gba/finance/health"));

    expect(handleFinanceDashboard).toHaveBeenCalled();
    expect(handleFinanceGeneralLedger).toHaveBeenCalled();
    expect(handleFinanceAccountsReceivable).toHaveBeenCalled();
    expect(handleFinanceAccountsPayable).toHaveBeenCalled();
    expect(handleFinanceBudgets).toHaveBeenCalled();
    expect(handleFinanceProfitability).toHaveBeenCalled();
    expect(handleFinanceForecasts).toHaveBeenCalled();
    expect(handleFinanceKpis).toHaveBeenCalled();
    expect(handleFinanceRecommendations).toHaveBeenCalled();
    expect(handleReviewFinanceRecommendation).toHaveBeenCalled();
    expect(handleFinanceExecutiveReports).toHaveBeenCalled();
    expect(handleFinanceHealth).toHaveBeenCalled();
  });
});
