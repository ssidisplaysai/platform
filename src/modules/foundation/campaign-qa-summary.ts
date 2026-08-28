import type { CampaignTargetExecutionRecord } from "./campaign-execution";

export type CampaignQaSummary = {
  approvedTargetCount: number;
  qaPassTargetCount: number;
  qaFailTargetCount: number;
  withoutTerminalQaCount: number;
  totalCheckPassCount: number;
  totalCheckFailureCount: number;
  failureReasonsByCheck: Readonly<Record<string, number>>;
  affectedProducts: readonly string[];
  affectedStates: readonly string[];
  affectedBlueprints: readonly string[];
  createSuccessCount: number;
  createFailureCount: number;
  exactUpdateSuccessCount: number;
  exactUpdateFailureCount: number;
};

function checkPassed(value: unknown): boolean {
  return value === true || String(value).toUpperCase() === "PASS";
}

function checkFailed(value: unknown): boolean {
  return value === false || String(value).toUpperCase() === "FAIL";
}

function affected(records: readonly CampaignTargetExecutionRecord[], value: (record: CampaignTargetExecutionRecord) => string | null): readonly string[] {
  return [...new Set(records.map(value).filter((entry): entry is string => Boolean(entry)))].sort();
}

export function summarizeCampaignQa(
  records: readonly CampaignTargetExecutionRecord[],
): CampaignQaSummary {
  const qaPass = records.filter((record) => record.status === "SUCCEEDED" && record.qaStatus === "COMPLETE");
  const qaFail = records.filter((record) => record.failureClass === "QA_FAILURE" || record.qaStatus === "FAILED_QA");
  const terminalQa = new Set([...qaPass, ...qaFail].map((record) => record.targetId));
  const failureReasonsByCheck: Record<string, number> = {};
  let totalCheckPassCount = 0;
  let totalCheckFailureCount = 0;
  records.forEach((record) => {
    Object.entries(record.qaChecks ?? {}).forEach(([check, value]) => {
      if (checkPassed(value)) totalCheckPassCount += 1;
      if (checkFailed(value)) {
        totalCheckFailureCount += 1;
        failureReasonsByCheck[check] = (failureReasonsByCheck[check] ?? 0) + 1;
      }
    });
    Object.keys(record.qaFailureReasons ?? {}).forEach((check) => {
      if (!(check in (record.qaChecks ?? {}))) {
        failureReasonsByCheck[check] = (failureReasonsByCheck[check] ?? 0) + 1;
      }
    });
  });
  const unsuccessful = (operation: CampaignTargetExecutionRecord["operation"]): number => records.filter((record) =>
    record.operation === operation
    && (record.status === "FAILED" || record.status === "RETRY_REVIEW_REQUIRED")).length;
  return {
    approvedTargetCount: records.length,
    qaPassTargetCount: qaPass.length,
    qaFailTargetCount: qaFail.length,
    withoutTerminalQaCount: records.filter((record) => !terminalQa.has(record.targetId)).length,
    totalCheckPassCount,
    totalCheckFailureCount,
    failureReasonsByCheck,
    affectedProducts: affected(qaFail, (record) => record.productId),
    affectedStates: affected(qaFail, (record) => record.stateCode),
    affectedBlueprints: affected(qaFail, (record) => record.pageBlueprintId),
    createSuccessCount: records.filter((record) => record.operation === "CREATE" && record.status === "SUCCEEDED").length,
    createFailureCount: unsuccessful("CREATE"),
    exactUpdateSuccessCount: records.filter((record) => record.operation === "EXACT_UPDATE" && record.status === "SUCCEEDED").length,
    exactUpdateFailureCount: unsuccessful("EXACT_UPDATE"),
  };
}