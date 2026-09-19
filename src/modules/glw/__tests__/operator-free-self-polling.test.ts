import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("operator-free self polling contracts", () => {
  test("schedules recursive exact-target polling and prevents overlap", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/glw/GlwCampaignOperatorControls.tsx"), "utf8");

    expect(source).toContain("const autoProgressPollTimerRef = useRef<number | null>(null)");
    expect(source).toContain("const autoProgressPollIntervalMs = 5000");
    expect(source).toContain("function scheduleOperatorFreeProgressionPoll(delayMs = autoProgressPollIntervalMs)");
    expect(source).toContain("window.setTimeout(() => {");
    expect(source).toContain("void runOperatorFreeProgression(autoTargetLockRef.current.targetId)");
    expect(source).toContain("if (autoProgressInFlight.current) {");
    expect(source).toContain("scheduleOperatorFreeProgressionPoll(1000)");
  });

  test("wait and non-terminal states schedule retry without requiring browser refresh", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/glw/GlwCampaignOperatorControls.tsx"), "utf8");

    expect(source).toContain("if (result.action === \"wait\")");
    expect(source).toContain("setAutoPipelineStage(\"WAITING FOR GENERATION\")");
    expect(source).toContain("await refreshWorkspace();");
    expect(source).toContain("scheduleOperatorFreeProgressionPoll();");
    expect(source).toContain("if (!exactTarget.jobId || !exactTarget.executionId)");
    expect(source).toContain("if (!exactTarget)");
  });

  test("automatic reconcile keeps exact target identity and does not batch", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/glw/GlwCampaignOperatorControls.tsx"), "utf8");

    expect(source).toContain("const reconcileBody = {");
    expect(source).toContain("targetId: exactTarget.targetId");
    expect(source).toContain("jobId: exactTarget.jobId");
    expect(source).toContain("executionId: exactTarget.executionId");
    expect(source).toContain("fetch(`/api/glw/campaigns/${campaignId}/reconcile`");
  });

  test("draft-ready auto-triggers visual certification and stops polling at owner review or failure", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/glw/GlwCampaignOperatorControls.tsx"), "utf8");

    expect(source).toContain("if (result.action === \"draft_ready\")");
    expect(source).toContain("/visual-certification");
    expect(source).toContain("setAutoPipelineStage(\"READY FOR OWNER REVIEW\")");
    expect(source).toContain("clearOperatorFreeProgressionPoll();");
    expect(source).toContain("setAutoPipelineStage(\"FAILED\")");
  });

  test("timer is cleared on unmount, lock clear, and published terminal state", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/glw/GlwCampaignOperatorControls.tsx"), "utf8");

    expect(source).toContain("useEffect(() => {");
    expect(source).toContain("return () => {");
    expect(source).toContain("clearOperatorFreeProgressionPoll();");
    expect(source).toContain("if (!autoTargetLock) {");
    expect(source).toContain("if (autoTarget?.lifecycleState === \"published\")");
    expect(source).toContain("document.addEventListener(\"visibilitychange\"");
  });
});
