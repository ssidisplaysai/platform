import type { GlwGeneratedDraftArtifact } from "./page-execution";

export type GlwPageRunStatus =
  | "CREATED"
  | "DISPATCHED"
  | "RUNNING"
  | "GENERATED"
  | "QA_PASSED"
  | "WORDPRESS_DRAFT"
  | "APPROVED"
  | "PUBLISHED"
  | "FAILED"
  | "ABANDONED";

export type GlwPageRunIdentity = {
  targetId: string;
  campaignId: string;
  organizationId: string;
  siteId: string;
  productId: string;
  stateCode: string;
  citySlug: string | null;
  cityName: string | null;
  canonicalPath: string;
};

export type GlwPageRunFailure = {
  code: string;
  message: string;
} | null;

export type GlwPageRunRecord = GlwPageRunIdentity & {
  runId: string;
  previousRunId: string | null;
  status: GlwPageRunStatus;
  generationJobId: string | null;
  externalExecutionId: string | null;
  generatedDraft: GlwGeneratedDraftArtifact | null;
  qaChecks: Readonly<Record<string, unknown>> | null;
  wordpressObjectId: string | null;
  wordpressUrl: string | null;
  wordpressStatus: "draft" | "publish" | null;
  failure: GlwPageRunFailure;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type GlwPageRunTransition =
  | {
      to: "DISPATCHED";
      generationJobId: string;
      externalExecutionId?: string | null;
    }
  | {
      to: "RUNNING";
      generationJobId: string;
      externalExecutionId: string;
    }
  | {
      to: "GENERATED";
      generationJobId: string;
      externalExecutionId: string;
      generatedDraft: GlwGeneratedDraftArtifact;
    }
  | {
      to: "QA_PASSED";
      qaChecks: Readonly<Record<string, unknown>>;
    }
  | {
      to: "WORDPRESS_DRAFT";
      wordpressObjectId: string;
      wordpressUrl: string | null;
    }
  | {
      to: "APPROVED";
    }
  | {
      to: "PUBLISHED";
      wordpressUrl: string | null;
    }
  | {
      to: "FAILED";
      code: string;
      message: string;
    }
  | {
      to: "ABANDONED";
      reason: string;
    };

const ALLOWED_TRANSITIONS: Readonly<Record<GlwPageRunStatus, readonly GlwPageRunStatus[]>> = {
  CREATED: ["DISPATCHED", "FAILED", "ABANDONED"],
  DISPATCHED: ["RUNNING", "GENERATED", "FAILED", "ABANDONED"],
  RUNNING: ["GENERATED", "FAILED", "ABANDONED"],
  GENERATED: ["QA_PASSED", "FAILED", "ABANDONED"],
  QA_PASSED: ["WORDPRESS_DRAFT", "FAILED", "ABANDONED"],
  WORDPRESS_DRAFT: ["APPROVED", "FAILED"],
  APPROVED: ["PUBLISHED", "FAILED"],
  PUBLISHED: [],
  FAILED: ["GENERATED"],
  ABANDONED: [],
};

export class GlwPageRunTransitionError extends Error {}

export function isGlwPageRunTerminal(status: GlwPageRunStatus): boolean {
  return status === "PUBLISHED" || status === "FAILED" || status === "ABANDONED";
}

export function createGlwPageRun(input: {
  runId: string;
  identity: GlwPageRunIdentity;
  previousRunId?: string | null;
  now?: string;
}): GlwPageRunRecord {
  const now = input.now ?? new Date().toISOString();
  const runId = input.runId.trim();
  if (!runId) throw new GlwPageRunTransitionError("PageRun requires a run ID.");

  const targetId = input.identity.targetId.trim();
  const campaignId = input.identity.campaignId.trim();
  const organizationId = input.identity.organizationId.trim();
  const siteId = input.identity.siteId.trim();
  const productId = input.identity.productId.trim();
  const stateCode = input.identity.stateCode.trim().toUpperCase();
  const canonicalPath = input.identity.canonicalPath.trim().replace(/^\/+|\/+$/g, "");

  if (!targetId || !campaignId || !organizationId || !siteId || !productId || !stateCode || !canonicalPath) {
    throw new GlwPageRunTransitionError("PageRun requires complete immutable target identity.");
  }

  return {
    runId,
    targetId,
    campaignId,
    organizationId,
    siteId,
    productId,
    stateCode,
    citySlug: input.identity.citySlug?.trim() || null,
    cityName: input.identity.cityName?.trim() || null,
    canonicalPath,
    previousRunId: input.previousRunId?.trim() || null,
    status: "CREATED",
    generationJobId: null,
    externalExecutionId: null,
    generatedDraft: null,
    qaChecks: null,
    wordpressObjectId: null,
    wordpressUrl: null,
    wordpressStatus: null,
    failure: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

function assertTransitionAllowed(from: GlwPageRunStatus, to: GlwPageRunStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new GlwPageRunTransitionError(`Invalid PageRun transition: ${from} -> ${to}`);
  }
}

function requireString(value: string, message: string): string {
  const normalized = value.trim();
  if (!normalized) throw new GlwPageRunTransitionError(message);
  return normalized;
}

export function advanceGlwPageRun(
  record: GlwPageRunRecord,
  transition: GlwPageRunTransition,
  now = new Date().toISOString(),
): GlwPageRunRecord {
  assertTransitionAllowed(record.status, transition.to);

  const base: GlwPageRunRecord = {
    ...record,
    status: transition.to,
    updatedAt: now,
    failure: null,
    completedAt: isGlwPageRunTerminal(transition.to) ? now : null,
  };

  switch (transition.to) {
    case "DISPATCHED": {
      const generationJobId = requireString(
        transition.generationJobId,
        "DISPATCHED PageRun requires a generation job ID.",
      );
      return {
        ...base,
        generationJobId,
        externalExecutionId: transition.externalExecutionId?.trim() || null,
      };
    }
    case "RUNNING": {
      const generationJobId = requireString(
        transition.generationJobId,
        "RUNNING PageRun requires a generation job ID.",
      );
      const externalExecutionId = requireString(
        transition.externalExecutionId,
        "RUNNING PageRun requires an external execution ID.",
      );
      if (record.generationJobId && record.generationJobId !== generationJobId) {
        throw new GlwPageRunTransitionError("PageRun generation job identity cannot change.");
      }
      return {
        ...base,
        generationJobId,
        externalExecutionId,
      };
    }
    case "GENERATED": {
      const generationJobId = requireString(
        transition.generationJobId,
        "GENERATED PageRun requires a generation job ID.",
      );
      const externalExecutionId = requireString(
        transition.externalExecutionId,
        "GENERATED PageRun requires an external execution ID.",
      );
      if (record.generationJobId && record.generationJobId !== generationJobId) {
        throw new GlwPageRunTransitionError("PageRun generation job identity cannot change.");
      }
      if (record.externalExecutionId && record.externalExecutionId !== externalExecutionId) {
        throw new GlwPageRunTransitionError("PageRun external execution identity cannot change.");
      }
      if (!transition.generatedDraft.contentHtml.trim()) {
        throw new GlwPageRunTransitionError("GENERATED PageRun requires generated content.");
      }
      return {
        ...base,
        generationJobId,
        externalExecutionId,
        generatedDraft: structuredClone(transition.generatedDraft),
      };
    }
    case "QA_PASSED":
      if (!record.generatedDraft) {
        throw new GlwPageRunTransitionError("QA_PASSED requires a generated draft.");
      }
      return {
        ...base,
        qaChecks: structuredClone(transition.qaChecks),
      };
    case "WORDPRESS_DRAFT": {
      const wordpressObjectId = requireString(
        transition.wordpressObjectId,
        "WORDPRESS_DRAFT requires a WordPress object ID.",
      );
      return {
        ...base,
        wordpressObjectId,
        wordpressUrl: transition.wordpressUrl?.trim() || null,
        wordpressStatus: "draft",
      };
    }
    case "APPROVED":
      if (!record.wordpressObjectId || record.wordpressStatus !== "draft") {
        throw new GlwPageRunTransitionError("APPROVED requires an existing WordPress draft.");
      }
      return base;
    case "PUBLISHED":
      if (!record.wordpressObjectId) {
        throw new GlwPageRunTransitionError("PUBLISHED requires an existing WordPress object.");
      }
      return {
        ...base,
        wordpressUrl: transition.wordpressUrl?.trim() || record.wordpressUrl,
        wordpressStatus: "publish",
      };
    case "FAILED":
      return {
        ...base,
        failure: {
          code: requireString(transition.code, "FAILED PageRun requires an error code."),
          message: requireString(transition.message, "FAILED PageRun requires an error message."),
        },
      };
    case "ABANDONED":
      return {
        ...base,
        failure: {
          code: "ABANDONED",
          message: requireString(transition.reason, "ABANDONED PageRun requires a reason."),
        },
      };
  }
}

export type GlwPageRunRepository = {
  create(record: GlwPageRunRecord): Promise<GlwPageRunRecord>;
  getById(runId: string): Promise<GlwPageRunRecord | null>;
  getByGenerationJobId(jobId: string): Promise<GlwPageRunRecord | null>;
  getActiveByTarget(targetId: string): Promise<GlwPageRunRecord | null>;
  listByCampaign(campaignId: string): Promise<readonly GlwPageRunRecord[]>;
  transition(
    runId: string,
    expectedStatus: GlwPageRunStatus,
    transition: GlwPageRunTransition,
  ): Promise<GlwPageRunRecord>;
  abandonAndReplace(input: {
    activeRunId: string;
    replacementRunId: string;
    reason: string;
  }): Promise<GlwPageRunRecord>;
};

export function createInMemoryGlwPageRunRepository(
  initial: readonly GlwPageRunRecord[] = [],
): GlwPageRunRepository {
  const runs = new Map(initial.map((record) => [record.runId, structuredClone(record)]));
  const activeByTarget = new Map<string, string>();

  for (const record of initial) {
    const current = activeByTarget.get(record.targetId);
    if (!current) {
      activeByTarget.set(record.targetId, record.runId);
      continue;
    }
    const existing = runs.get(current)!;
    if (new Date(record.createdAt).getTime() >= new Date(existing.createdAt).getTime()) {
      activeByTarget.set(record.targetId, record.runId);
    }
  }

  return {
    async create(record) {
      if (runs.has(record.runId)) {
        throw new GlwPageRunTransitionError(`PageRun already exists: ${record.runId}`);
      }
      const activeId = activeByTarget.get(record.targetId);
      if (activeId) {
        const active = runs.get(activeId);
        if (active && !isGlwPageRunTerminal(active.status)) {
          throw new GlwPageRunTransitionError("Target already has an active PageRun.");
        }
      }
      runs.set(record.runId, structuredClone(record));
      activeByTarget.set(record.targetId, record.runId);
      return structuredClone(record);
    },
    async getById(runId) {
      const record = runs.get(runId);
      return record ? structuredClone(record) : null;
    },
    async getByGenerationJobId(jobId) {
      const normalizedJobId = jobId.trim();
      if (!normalizedJobId) return null;
      const record = Array.from(runs.values())
        .filter((candidate) => candidate.generationJobId === normalizedJobId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
      return record ? structuredClone(record) : null;
    },
    async getActiveByTarget(targetId) {
      const runId = activeByTarget.get(targetId);
      if (!runId) return null;
      const record = runs.get(runId);
      return record ? structuredClone(record) : null;
    },
    async listByCampaign(campaignId) {
      return Array.from(runs.values())
        .filter((record) => record.campaignId === campaignId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((record) => structuredClone(record));
    },
    async transition(runId, expectedStatus, transition) {
      const record = runs.get(runId);
      if (!record) throw new GlwPageRunTransitionError(`Unknown PageRun: ${runId}`);
      if (record.status !== expectedStatus) {
        throw new GlwPageRunTransitionError(
          `PageRun status changed: expected ${expectedStatus}, found ${record.status}`,
        );
      }
      const updated = advanceGlwPageRun(record, transition);
      runs.set(runId, updated);
      return structuredClone(updated);
    },
    async abandonAndReplace(input) {
      const current = runs.get(input.activeRunId);
      if (!current) throw new GlwPageRunTransitionError("Active PageRun was not found.");
      if (activeByTarget.get(current.targetId) !== current.runId) {
        throw new GlwPageRunTransitionError("PageRun is no longer active for its target.");
      }
      if (current.wordpressObjectId) {
        throw new GlwPageRunTransitionError(
          "Discard and regenerate is blocked after WordPress draft creation; resolve the draft first.",
        );
      }
      if (isGlwPageRunTerminal(current.status)) {
        throw new GlwPageRunTransitionError("Terminal PageRun cannot be abandoned.");
      }

      const abandoned = advanceGlwPageRun(current, {
        to: "ABANDONED",
        reason: input.reason,
      });
      runs.set(current.runId, abandoned);

      const replacement = createGlwPageRun({
        runId: input.replacementRunId,
        identity: current,
        previousRunId: current.runId,
      });
      runs.set(replacement.runId, replacement);
      activeByTarget.set(current.targetId, replacement.runId);
      return structuredClone(replacement);
    },
  };
}
