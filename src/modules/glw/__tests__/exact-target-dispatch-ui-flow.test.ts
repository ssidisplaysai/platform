import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  runExactTargetDispatchFlow,
  type ExactDispatchScheduler,
  type ExactDispatchStage,
} from "../exact-target-dispatch-ui-flow";

const NOW = Date.parse("2026-09-16T12:00:00.000Z");

function scheduler(
  preflight: ExactDispatchScheduler["dispatchPreflight"],
  targetId = "target-campaign-ca",
): ExactDispatchScheduler {
  return {
    schedule: {
      remainingAllowance: 1,
      nextTargets: [{ targetId, stateCode: "CA", cityName: null }],
    },
    releaseAuthority: { capability: { ready: true } },
    wordpressReadiness: { ready: true },
    executionPreflight: { ready: true },
    dispatchPreflight: preflight,
  };
}

function preflight(expiresAt = "2026-09-16T12:05:00.000Z", targetId = "target-campaign-ca") {
  return {
    preflightReceiptId: "dispatch-preflight-fresh",
    targetId,
    expiresAt,
    publicationPolicy: "draft",
  };
}

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function flowInput(
  current: ExactDispatchScheduler,
  fetcher: jest.MockedFunction<typeof fetch>,
  stages: ExactDispatchStage[],
) {
  return {
    campaignId: "campaign-outdoor",
    organizationId: "org",
    siteId: "site",
    scheduler: current,
    requestHeaders: () => ({}),
    confirm: () => true,
    onStage: (stage: ExactDispatchStage) => stages.push(stage),
    onSchedulerRefreshed: jest.fn(),
    now: () => NOW,
    fetcher,
  };
}

describe("exact-target dispatch operator UI flow", () => {
  test("expired preflight requests a fresh governed preflight before authorization", async () => {
    const fresh = scheduler(preflight());
    const fetcher = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(response(fresh))
      .mockResolvedValueOnce(response({ grant: { grantId: "grant-1" } }))
      .mockResolvedValueOnce(response({ dispatchedCount: 1, errorCount: 0, publicationPerformed: false }));
    const stages: ExactDispatchStage[] = [];

    await runExactTargetDispatchFlow(flowInput(
      scheduler(preflight("2026-09-16T11:59:59.000Z")),
      fetcher,
      stages,
    ));

    expect(fetcher.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["/api/glw/campaigns/campaign-outdoor/scheduler", "GET"],
      ["/api/glw/campaigns/campaign-outdoor/dispatch-authorization", "POST"],
      ["/api/glw/campaigns/campaign-outdoor/scheduler", "POST"],
    ]);
    expect(stages).toEqual(["REFRESHING PREFLIGHT", "READY TO AUTHORIZE", "DISPATCHING", "DISPATCH ACCEPTED"]);
  });

  test("fresh preflight completes the existing grant and exact dispatch flow", async () => {
    const fetcher = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ grant: { grantId: "grant-1" } }))
      .mockResolvedValueOnce(response({ dispatchedCount: 1, errorCount: 0, publicationPerformed: false }));
    const stages: ExactDispatchStage[] = [];

    const result = await runExactTargetDispatchFlow(flowInput(scheduler(preflight()), fetcher, stages));

    expect(result).toMatchObject({ accepted: true, payload: { dispatchedCount: 1 } });
    const grantBody = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    const dispatchBody = JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    expect(grantBody).toMatchObject({ preflightReceiptId: "dispatch-preflight-fresh", targetId: "target-campaign-ca" });
    expect(dispatchBody).toMatchObject({ preflightReceiptId: "dispatch-preflight-fresh", ownerDispatchGrantId: "grant-1", targetId: "target-campaign-ca" });
  });

  test("duplicate click is synchronously blocked before a second flow can dispatch", () => {
    const controls = readFileSync(
      join(process.cwd(), "src/modules/glw/GlwCampaignOperatorControls.tsx"),
      "utf8",
    );
    const guard = controls.indexOf("if (!scheduler || dispatchInFlight.current) return;");
    const acquire = controls.indexOf("dispatchInFlight.current = true;", guard);
    const run = controls.indexOf("runExactTargetDispatchFlow({", acquire);
    const release = controls.indexOf("dispatchInFlight.current = false;", run);
    const finallyBlock = controls.lastIndexOf("} finally {", release);
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(acquire);
    expect(acquire).toBeLessThan(run);
    expect(finallyBlock).toBeGreaterThan(run);
    expect(release).toBeGreaterThan(finallyBlock);
  });

  test("failed preflight refresh surfaces the exact server error", async () => {
    const fetcher = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ error: "GOVERNED_PREFLIGHT_REFRESH_DENIED" }, 409));

    await expect(runExactTargetDispatchFlow(flowInput(
      scheduler(preflight("2026-09-16T11:59:59.000Z")),
      fetcher,
      [],
    ))).rejects.toThrow("GOVERNED_PREFLIGHT_REFRESH_DENIED");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("valid existing preflight does not refresh unnecessarily", async () => {
    const fetcher = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ grant: { grantId: "grant-1" } }))
      .mockResolvedValueOnce(response({ dispatchedCount: 1, errorCount: 0, publicationPerformed: false }));

    await runExactTargetDispatchFlow(flowInput(scheduler(preflight()), fetcher, []));

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0]).toBe("/api/glw/campaigns/campaign-outdoor/dispatch-authorization");
  });

  test("changed target during refresh fails closed before grant or dispatch", async () => {
    const fetcher = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(response(scheduler(preflight("2026-09-16T12:05:00.000Z", "target-campaign-nv"), "target-campaign-nv")));

    await expect(runExactTargetDispatchFlow(flowInput(
      scheduler(preflight("2026-09-16T11:59:59.000Z")),
      fetcher,
      [],
    ))).rejects.toThrow("EXACT_TARGET_CHANGED_DURING_PREFLIGHT_REFRESH");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});