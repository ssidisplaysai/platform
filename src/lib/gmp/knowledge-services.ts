import { createHash } from "node:crypto";
import { getGenesisOrchestrationRuntime } from "@/platform/gop/runtime/orchestration-runtime";
import type { GmpProject, GmpSite } from "./models";
import { createPrismaGmpRepository, type GmpRepository } from "./repository";
import {
  GMP_KNOWLEDGE_COMPLETENESS_MODEL_VERSION,
  GMP_KNOWLEDGE_CONTEXT_SCHEMA_VERSION,
  type GmpBusinessKnowledgeWorkspace,
  type GmpContextAssemblyRecord,
  type GmpKnowledgeCompletenessAssessment,
  type GmpKnowledgeConflict,
  type GmpKnowledgeDomain,
  type GmpKnowledgeRecord,
} from "./knowledge-models";
import { createPrismaGmpKnowledgeRepository, type GmpKnowledgeRepository } from "./knowledge-repository";

type CompletenessRule = {
  domain: GmpKnowledgeDomain;
  key: string;
  critical: boolean;
};

const COMPLETENESS_RULES: CompletenessRule[] = [
  { domain: "company_identity", key: "company_profile", critical: true },
  { domain: "brand", key: "brand_voice", critical: true },
  { domain: "audiences", key: "primary_audience", critical: true },
  { domain: "products", key: "primary_product", critical: true },
  { domain: "value_propositions", key: "core_value_prop", critical: true },
  { domain: "differentiators", key: "key_differentiator", critical: true },
  { domain: "applications", key: "primary_application", critical: true },
  { domain: "industries", key: "primary_industry", critical: true },
  { domain: "claims", key: "approved_claim", critical: true },
  { domain: "proof_points", key: "core_proof", critical: true },
  { domain: "contact_conversion", key: "conversion_contact", critical: true },
  { domain: "marketing_goals", key: "primary_goal", critical: false },
  { domain: "seo_topics", key: "primary_topic", critical: false },
  { domain: "restricted_messaging", key: "restricted_message", critical: false },
];

export type GmpKnowledgeServices = {
  ensureWorkspace: (projectId: string) => Promise<GmpBusinessKnowledgeWorkspace>;
  submitRecordForReview: (recordId: string, actorId: string, notes?: string) => Promise<GmpKnowledgeRecord | null>;
  approveRecord: (recordId: string, actorId: string, notes?: string) => Promise<GmpKnowledgeRecord | null>;
  rejectRecord: (recordId: string, actorId: string, notes?: string) => Promise<GmpKnowledgeRecord | null>;
  runConflictScan: (projectId: string, actorId: string) => Promise<GmpKnowledgeConflict[]>;
  runCompletenessAssessment: (projectId: string, actorId: string) => Promise<GmpKnowledgeCompletenessAssessment>;
  assembleContext: (input: {
    projectId: string;
    actorId: string;
    siteId?: string;
    operationType: string;
    previewMode?: boolean;
    inputMetadata?: Record<string, unknown>;
  }) => Promise<GmpContextAssemblyRecord>;
};

function stableHash(value: unknown): string {
  const encoded = JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
  return createHash("sha256").update(encoded).digest("hex");
}

function recordIsActive(record: GmpKnowledgeRecord): boolean {
  if (record.archivedAt) {
    return false;
  }
  return record.status !== "ARCHIVED" && record.status !== "SUPERSEDED";
}

function recordIsApproved(record: GmpKnowledgeRecord): boolean {
  return record.reviewState === "APPROVED" && record.status === "APPROVED" && recordIsActive(record);
}

async function createGopExecution(projectId: string, workspaceId: string, operationType: string, actorId: string, recordIds: string[]) {
  const runtime = getGenesisOrchestrationRuntime();
  const execution = runtime.createExecution({
    executionType: "gmp_knowledge_operation",
    workspaceId,
    moduleId: "gmp.knowledge",
    jobType: "PAGE_GENERATION",
    executionClass: "AUTOMATED",
    priority: "NORMAL",
    input: {
      projectId,
      operationType,
      recordIds,
    },
    correlationId: `${projectId}:${operationType}:${Date.now()}`,
  });

  runtime.syncGlwExecutionState({
    jobId: execution.jobId ?? `gmp_knowledge_${execution.executionId}`,
    status: "RUNNING",
    correlationId: execution.correlationId,
    result: {
      operationType,
      actorId,
      projectId,
      recordCount: recordIds.length,
    },
  });

  return execution.executionId;
}

export function createGmpKnowledgeServices(dependencies?: {
  knowledgeRepository?: GmpKnowledgeRepository;
  projectRepository?: GmpRepository;
}): GmpKnowledgeServices {
  const knowledgeRepository = dependencies?.knowledgeRepository ?? createPrismaGmpKnowledgeRepository();
  const projectRepository = dependencies?.projectRepository ?? createPrismaGmpRepository();

  return {
    async ensureWorkspace(projectId) {
      return knowledgeRepository.ensureWorkspace(projectId);
    },

    async submitRecordForReview(recordId, actorId, notes) {
      const record = await knowledgeRepository.getRecordById(recordId);
      if (!record) return null;

      const updated = await knowledgeRepository.updateRecord(recordId, {
        reviewState: "REQUIRES_REVIEW",
        status: record.status === "DRAFT" ? "ACTIVE" : record.status,
      });

      if (!updated) return null;

      await knowledgeRepository.createReview({
        projectId: record.projectId,
        knowledgeWorkspaceId: record.knowledgeWorkspaceId,
        knowledgeRecordId: recordId,
        assignedTo: undefined,
        reviewState: "REQUIRES_REVIEW",
        operatorNotes: notes,
        reviewNotes: undefined,
        requestedBy: actorId,
        requestedAt: new Date().toISOString(),
        completedBy: undefined,
        completedAt: null,
        metadata: { action: "submit_for_review" },
      });

      return updated;
    },

    async approveRecord(recordId, actorId, notes) {
      const record = await knowledgeRepository.getRecordById(recordId);
      if (!record) return null;

      const updated = await knowledgeRepository.updateRecord(recordId, {
        reviewState: "APPROVED",
        status: "APPROVED",
        conflictState: "NONE",
      });

      if (!updated) return null;

      await knowledgeRepository.createApproval({
        projectId: record.projectId,
        knowledgeWorkspaceId: record.knowledgeWorkspaceId,
        knowledgeRecordId: recordId,
        decision: "APPROVED",
        approvalNotes: notes,
        decidedBy: actorId,
        decidedAt: new Date().toISOString(),
        metadata: { action: "approve" },
      });

      const workspace = await knowledgeRepository.getWorkspaceByProjectId(record.projectId);
      if (workspace) {
        await knowledgeRepository.updateWorkspace(workspace.knowledgeWorkspaceId, {
          lifecycleState: "APPROVED",
          lastApprovedAt: new Date().toISOString(),
          approvedBy: actorId,
          workspaceVersion: workspace.workspaceVersion + 1,
        });
      }

      return updated;
    },

    async rejectRecord(recordId, actorId, notes) {
      const record = await knowledgeRepository.getRecordById(recordId);
      if (!record) return null;

      const updated = await knowledgeRepository.updateRecord(recordId, {
        reviewState: "REJECTED",
        status: "REJECTED",
      });
      if (!updated) return null;

      await knowledgeRepository.createApproval({
        projectId: record.projectId,
        knowledgeWorkspaceId: record.knowledgeWorkspaceId,
        knowledgeRecordId: recordId,
        decision: "REJECTED",
        approvalNotes: notes,
        decidedBy: actorId,
        decidedAt: new Date().toISOString(),
        metadata: { action: "reject" },
      });

      return updated;
    },

    async runConflictScan(projectId, actorId) {
      const workspace = await knowledgeRepository.ensureWorkspace(projectId);
      const records = await knowledgeRepository.listRecords(projectId, { includeArchived: false });

      const active = records.filter((record) => recordIsActive(record));
      const groups = new Map<string, GmpKnowledgeRecord[]>();
      for (const record of active) {
        const key = `${record.domain}:${record.canonicalKey}`;
        const existing = groups.get(key) ?? [];
        existing.push(record);
        groups.set(key, existing);
      }

      const conflicts: GmpKnowledgeConflict[] = [];
      for (const [groupKey, members] of groups.entries()) {
        if (members.length < 2) {
          continue;
        }

        const valueHashes = new Set(members.map((member) => stableHash(member.normalizedValue ?? member.structuredValue)));
        if (valueHashes.size <= 1) {
          continue;
        }

        const conflict = await knowledgeRepository.upsertConflict({
          projectId,
          knowledgeWorkspaceId: workspace.knowledgeWorkspaceId,
          conflictGroup: groupKey,
          conflictReason: "Multiple active records with conflicting values for the same canonical key.",
          severity: members.some((member) => member.reviewState === "APPROVED") ? "HIGH" : "MEDIUM",
          resolutionStatus: "OPEN",
          selectedRecordId: undefined,
          resolutionNotes: undefined,
          resolvedBy: undefined,
          resolvedAt: null,
          metadata: { generatedBy: "deterministic_conflict_scan" },
        }, members.map((member) => member.knowledgeRecordId));

        conflicts.push(conflict);
        for (const member of members) {
          await knowledgeRepository.updateRecord(member.knowledgeRecordId, { conflictState: "CONFLICTED" });
        }
      }

      await createGopExecution(projectId, "glw-led-display-warehouse", "knowledge_conflict_scan", actorId, active.map((entry) => entry.knowledgeRecordId));
      return conflicts;
    },

    async runCompletenessAssessment(projectId, actorId) {
      const workspace = await knowledgeRepository.ensureWorkspace(projectId);
      const records = await knowledgeRepository.listRecords(projectId, { includeArchived: false });
      const approved = records.filter((record) => recordIsApproved(record));

      const domainScores: Record<string, number> = {};
      const missingCriticalFields: string[] = [];
      const missingRecommendedFields: string[] = [];

      const byKey = new Set(approved.map((record) => `${record.domain}:${record.canonicalKey}`));
      for (const rule of COMPLETENESS_RULES) {
        const key = `${rule.domain}:${rule.key}`;
        const exists = byKey.has(key);
        if (!exists && rule.critical) {
          missingCriticalFields.push(key);
        }
        if (!exists && !rule.critical) {
          missingRecommendedFields.push(key);
        }
      }

      const conflictRecords = records.filter((record) => record.conflictState === "CONFLICTED");
      const unapprovedRecords = records.filter((record) => record.reviewState !== "APPROVED" && recordIsActive(record));
      const expiredRecords = records.filter((record) => record.effectiveUntil && new Date(record.effectiveUntil).getTime() < Date.now());

      const domainSet = new Set(records.map((record) => record.domain));
      for (const domain of domainSet) {
        const domainRecords = records.filter((record) => record.domain === domain && recordIsActive(record));
        const approvedCount = domainRecords.filter((record) => record.reviewState === "APPROVED").length;
        domainScores[domain] = domainRecords.length === 0 ? 0 : Math.round((approvedCount / domainRecords.length) * 100);
      }

      const maxScore = COMPLETENESS_RULES.length;
      const achieved = maxScore - (missingCriticalFields.length * 2 + missingRecommendedFields.length);
      const overallScore = Math.max(0, Math.min(100, Math.round((achieved / maxScore) * 100)));

      const assessment = await knowledgeRepository.createCompletenessAssessment({
        projectId,
        knowledgeWorkspaceId: workspace.knowledgeWorkspaceId,
        scoringModelVersion: GMP_KNOWLEDGE_COMPLETENESS_MODEL_VERSION,
        overallScore,
        domainScores,
        missingCriticalFields,
        missingRecommendedFields,
        conflictedFields: conflictRecords.map((record) => `${record.domain}:${record.canonicalKey}`),
        unapprovedFields: unapprovedRecords.map((record) => `${record.domain}:${record.canonicalKey}`),
        expiredFields: expiredRecords.map((record) => `${record.domain}:${record.canonicalKey}`),
        metadata: {
          criticalRuleCount: COMPLETENESS_RULES.filter((rule) => rule.critical).length,
          recommendedRuleCount: COMPLETENESS_RULES.filter((rule) => !rule.critical).length,
        },
      });

      await knowledgeRepository.updateWorkspace(workspace.knowledgeWorkspaceId, {
        completenessScore: assessment.overallScore,
        confidenceScore: Math.max(0, 100 - Math.round((assessment.conflictedFields.length / Math.max(1, records.length)) * 100)),
        lastReviewedAt: new Date().toISOString(),
        lifecycleState: assessment.overallScore >= 75 ? "IN_REVIEW" : "DRAFT",
      });

      await createGopExecution(projectId, "glw-led-display-warehouse", "knowledge_completeness_assessment", actorId, records.map((entry) => entry.knowledgeRecordId));

      return assessment;
    },

    async assembleContext(input) {
      const workspace = await knowledgeRepository.ensureWorkspace(input.projectId);
      const [project, sites, records] = await Promise.all([
        projectRepository.getProjectById(input.projectId),
        projectRepository.listSitesForProject(input.projectId),
        knowledgeRepository.listRecords(input.projectId, { includeArchived: false }),
      ]);

      const selectedSite = input.siteId ? sites.find((site) => site.siteId === input.siteId) : undefined;
      const scopedRecords = records
        .filter((record) => (input.previewMode ? recordIsActive(record) : recordIsApproved(record)))
        .sort((left, right) => left.canonicalKey.localeCompare(right.canonicalKey));

      const assembledContext = buildContextPayload({
        project,
        site: selectedSite,
        workspace,
        records: scopedRecords,
        operationType: input.operationType,
      });

      const recordVersions: Record<string, number> = {};
      for (const record of scopedRecords) {
        recordVersions[record.knowledgeRecordId] = record.version;
      }

      const gopExecutionId = await createGopExecution(
        input.projectId,
        project?.workspaceId ?? "glw-led-display-warehouse",
        "knowledge_context_assembly",
        input.actorId,
        scopedRecords.map((entry) => entry.knowledgeRecordId),
      );

      return knowledgeRepository.createContextAssemblyRecord({
        projectId: input.projectId,
        knowledgeWorkspaceId: workspace.knowledgeWorkspaceId,
        siteId: selectedSite?.siteId,
        operationType: input.operationType,
        previewMode: Boolean(input.previewMode),
        inputMetadata: input.inputMetadata,
        assembledContext,
        schemaVersion: GMP_KNOWLEDGE_CONTEXT_SCHEMA_VERSION,
        knowledgeWorkspaceVersion: workspace.workspaceVersion,
        recordVersions,
        gopExecutionId,
        createdBy: input.actorId,
        metadata: {
          mode: input.previewMode ? "preview" : "approved_only",
        },
      });
    },
  };
}

function buildContextPayload(input: {
  project: GmpProject | null;
  site?: GmpSite;
  workspace: GmpBusinessKnowledgeWorkspace;
  records: GmpKnowledgeRecord[];
  operationType: string;
}) {
  const byDomain: Record<string, Array<{ key: string; title: string; summary?: string; value: Record<string, unknown>; sources: number }>> = {};
  for (const record of input.records) {
    const bucket = byDomain[record.domain] ?? [];
    bucket.push({
      key: record.canonicalKey,
      title: record.title,
      summary: record.summary,
      value: record.normalizedValue ?? record.structuredValue,
      sources: record.sourceCount,
    });
    byDomain[record.domain] = bucket;
  }

  return {
    schemaVersion: GMP_KNOWLEDGE_CONTEXT_SCHEMA_VERSION,
    assembledAt: new Date().toISOString(),
    operationType: input.operationType,
    projectIdentity: input.project
      ? {
        projectId: input.project.projectId,
        name: input.project.name,
        slug: input.project.slug,
        locale: input.project.defaultLocale,
        language: input.project.defaultLanguage,
        timezone: input.project.timezone,
      }
      : null,
    siteContext: input.site
      ? {
        siteId: input.site.siteId,
        domain: input.site.primaryDomain,
        environment: input.site.environment,
        publishingPlatform: input.site.publishingPlatform,
      }
      : null,
    workspace: {
      knowledgeWorkspaceId: input.workspace.knowledgeWorkspaceId,
      workspaceVersion: input.workspace.workspaceVersion,
      lifecycleState: input.workspace.lifecycleState,
      completenessScore: input.workspace.completenessScore,
      confidenceScore: input.workspace.confidenceScore,
    },
    knowledgeDomains: byDomain,
    restrictions: byDomain.restricted_messaging ?? [],
    traceability: {
      recordCount: input.records.length,
      approvedOnly: true,
    },
  };
}
