type CompatibilityIssue = {
  strategyField?: string;
  materialClass?: string;
  reason?: string;
};

type CompatibilityPayload = {
  unsupported?: CompatibilityIssue[];
};

export type SiteBuildErrorPresentation = {
  summary: string;
  field: string | null;
  action: string | null;
  diagnostics: string;
};

function parseCompatibilityPayload(error: string): CompatibilityPayload | null {
  const separator = error.indexOf(":");
  if (separator < 0) return null;
  const raw = error.slice(separator + 1);
  try {
    return JSON.parse(raw) as CompatibilityPayload;
  } catch {
    return null;
  }
}

function actionForClass(materialClass: string | undefined): string {
  switch (materialClass) {
    case "CONVERSION_CTA_INTENT":
      return "Confirm conversion language stays within approved offering scope and approved strategy intent.";
    case "PROOF_GUARDRAIL_INSTRUCTION":
    case "INTERNAL_GOVERNANCE_INSTRUCTION":
      return "Keep this as an internal guardrail statement and verify no unsupported factual claims are implied.";
    case "MARKET_AUDIENCE_CLAIM":
      return "Align audience wording with approved offerings, verified capabilities, and approved source evidence.";
    case "CAPABILITY_CLAIM":
      return "Limit capability language to owner-approved, currently verified capabilities.";
    case "TECHNICAL_FACTUAL_CLAIM":
      return "Add approved technical/source evidence or remove unsupported technical claims.";
    default:
      return "Review strategy wording against approved authority records and remove unsupported claims.";
  }
}

export function parseSiteBuildError(error: string): SiteBuildErrorPresentation {
  if (!error.startsWith("BUILD_PLAN_AUTHORITY_COMPATIBILITY_FAILED")) {
    return {
      summary: error,
      field: null,
      action: null,
      diagnostics: error,
    };
  }

  const payload = parseCompatibilityPayload(error);
  const issue = payload?.unsupported?.[0];
  const field = issue?.strategyField ?? null;
  const reason = issue?.reason ?? "The strategy material did not satisfy authority compatibility requirements.";

  return {
    summary: "Build plan compatibility check blocked unsupported strategy material.",
    field,
    action: actionForClass(issue?.materialClass),
    diagnostics: JSON.stringify(
      {
        reason,
        unsupportedCount: payload?.unsupported?.length ?? 0,
        firstUnsupported: issue ?? null,
        rawError: error,
      },
      null,
      2,
    ),
  };
}

