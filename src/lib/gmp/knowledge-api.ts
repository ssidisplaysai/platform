import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { createPrismaGmpRepository, type GmpRepository } from "./repository";
import { type GmpProject } from "./models";
import {
  parseKnowledgeDomain,
  parseKnowledgeSourceType,
  validateKnowledgeRecordInput,
  type GmpKnowledgeRecord,
} from "./knowledge-models";
import { createPrismaGmpKnowledgeRepository, type GmpKnowledgeRepository } from "./knowledge-repository";
import { createGmpKnowledgeServices, type GmpKnowledgeServices } from "./knowledge-services";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_MODULE_ID = "gmp.knowledge";

type KnowledgeAction =
  | "gmp:knowledge:view"
  | "gmp:knowledge:create"
  | "gmp:knowledge:edit_draft"
  | "gmp:knowledge:submit_review"
  | "gmp:knowledge:review"
  | "gmp:knowledge:approve"
  | "gmp:knowledge:reject"
  | "gmp:knowledge:archive"
  | "gmp:knowledge:manage_sources"
  | "gmp:knowledge:resolve_conflicts"
  | "gmp:knowledge:run_completeness"
  | "gmp:knowledge:assemble_context"
  | "gmp:knowledge:preview_unapproved";

export type GmpKnowledgeApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  projectRepository?: GmpRepository;
  knowledgeRepository?: GmpKnowledgeRepository;
  knowledgeServices?: GmpKnowledgeServices;
};

function deps(input?: GmpKnowledgeApiDependencies): Required<GmpKnowledgeApiDependencies> {
  const projectRepository = input?.projectRepository ?? createPrismaGmpRepository();
  const knowledgeRepository = input?.knowledgeRepository ?? createPrismaGmpKnowledgeRepository();

  return {
    sessionLoader: input?.sessionLoader ?? getGlwSession,
    projectRepository,
    knowledgeRepository,
    knowledgeServices: input?.knowledgeServices ?? createGmpKnowledgeServices({
      projectRepository,
      knowledgeRepository,
    }),
  };
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function workspaceFromUrl(url: URL): string {
  return url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID;
}

type KnowledgeAuthorizeResult =
  | { error: NextResponse }
  | { subject: ReturnType<typeof buildGenesisSubjectFromSession> };

async function authorize(input: {
  actionId: KnowledgeAction;
  workspaceId: string;
  route: string;
  dependencies?: GmpKnowledgeApiDependencies;
}): Promise<KnowledgeAuthorizeResult> {
  const d = deps(input.dependencies);
  const session = await d.sessionLoader();
  if (!session) {
    return { error: json({ error: "GLW session is required." }, 401) } as const;
  }

  const subject = buildGenesisSubjectFromSession(session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId: input.workspaceId,
    moduleId: DEFAULT_MODULE_ID,
    action: createActionReference(input.actionId, "route_access"),
    resource: {
      workspaceId: input.workspaceId,
      moduleId: DEFAULT_MODULE_ID,
      route: input.route,
    },
  });

  if (!decision.allowed) {
    return { error: json({ error: decision.reason }, 403) } as const;
  }

  return { subject } as const;
}

async function ensureProject(projectId: string, workspaceId: string, dependencies?: GmpKnowledgeApiDependencies): Promise<GmpProject | null> {
  const d = deps(dependencies);
  const project = await d.projectRepository.getProjectById(projectId);
  if (!project || project.workspaceId !== workspaceId) {
    return null;
  }

  return project;
}

async function ensureRecord(recordId: string, workspaceId: string, dependencies?: GmpKnowledgeApiDependencies): Promise<GmpKnowledgeRecord | null> {
  const d = deps(dependencies);
  const record = await d.knowledgeRepository.getRecordById(recordId);
  if (!record) {
    return null;
  }

  const project = await d.projectRepository.getProjectById(record.projectId);
  if (!project || project.workspaceId !== workspaceId) {
    return null;
  }

  return record;
}

export async function handleGetKnowledgeWorkspace(request: Request, projectId: string, dependencies?: GmpKnowledgeApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:knowledge:view", workspaceId, route: "/api/gmp/projects/[id]/knowledge", dependencies });
  if ("error" in access) return access.error;

  const d = deps(dependencies);
  const project = await ensureProject(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const [knowledgeWorkspace, records, sources, conflicts, reviewQueue, latestCompleteness] = await Promise.all([
    d.knowledgeServices.ensureWorkspace(projectId),
    d.knowledgeRepository.listRecords(projectId, { includeArchived: false }),
    d.knowledgeRepository.listSources(projectId),
    d.knowledgeRepository.listConflicts(projectId),
    d.knowledgeRepository.listReviewQueue(projectId),
    d.knowledgeRepository.getLatestCompletenessAssessment(projectId),
  ]);

  const approvedCount = records.filter((record) => record.reviewState === "APPROVED").length;
  const draftCount = records.filter((record) => record.reviewState === "DRAFT").length;

  return json({
    project,
    knowledgeWorkspace,
    readiness: {
      status: knowledgeWorkspace.lifecycleState,
      completenessScore: knowledgeWorkspace.completenessScore,
      approvedRecordCount: approvedCount,
      draftRecordCount: draftCount,
      conflictCount: conflicts.length,
      requiresReviewCount: reviewQueue.length,
      sourceCount: sources.length,
      lastApprovedVersion: knowledgeWorkspace.workspaceVersion,
      businessGenomeConnectionStatus: project.businessGenomeReference ? "linked" : "pending",
    },
    latestCompleteness,
  });
}

export async function handleCreateKnowledgeRecord(request: Request, projectId: string, dependencies?: GmpKnowledgeApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:knowledge:create", workspaceId, route: "/api/gmp/projects/[id]/knowledge/records", dependencies });
  if ("error" in access) return access.error;

  const d = deps(dependencies);
  const project = await ensureProject(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  const validated = validateKnowledgeRecordInput(input);
  if (!validated.ok) return json({ error: validated.error }, 400);

  const knowledgeWorkspace = await d.knowledgeServices.ensureWorkspace(projectId);
  const existing = await d.knowledgeRepository.listRecords(projectId, {
    domain: validated.value.domain,
    includeArchived: false,
  });
  const duplicate = existing.find((record) => record.canonicalKey === validated.value.canonicalKey && !record.archivedAt && record.status !== "SUPERSEDED");
  if (duplicate) {
    return json({ error: "A record with this canonical key is already active in the selected domain." }, 409);
  }

  const created = await d.knowledgeRepository.createRecord({
    projectId,
    knowledgeWorkspaceId: knowledgeWorkspace.knowledgeWorkspaceId,
    domain: validated.value.domain,
    recordType: validated.value.recordType,
    canonicalKey: validated.value.canonicalKey,
    title: validated.value.title,
    summary: validated.value.summary,
    structuredValue: validated.value.structuredValue,
    normalizedValue: validated.value.normalizedValue,
    status: "DRAFT",
    confidence: validated.value.confidence ?? 50,
    priority: validated.value.priority ?? 50,
    effectiveFrom: null,
    effectiveUntil: null,
    sourceCount: 0,
    conflictState: "NONE",
    reviewState: "DRAFT",
    parentRecordId: validated.value.parentRecordId,
    supersededByRecordId: undefined,
    archivedAt: null,
    metadata: {
      createdBy: access.subject.actorId,
    },
  });

  await d.knowledgeRepository.createRecordVersion({
    knowledgeRecordId: created.knowledgeRecordId,
    projectId,
    knowledgeWorkspaceId: knowledgeWorkspace.knowledgeWorkspaceId,
    versionNumber: 1,
    previousValue: undefined,
    newValue: {
      structuredValue: created.structuredValue,
      normalizedValue: created.normalizedValue,
      summary: created.summary,
      status: created.status,
      reviewState: created.reviewState,
    },
    changeReason: "Record created",
    changedBy: access.subject.actorId,
    changedAt: new Date().toISOString(),
    sourceImpact: {},
    approvalImpact: {},
    metadata: {},
  });

  return json({ record: created }, 201);
}

export async function handleListKnowledgeRecords(request: Request, projectId: string, dependencies?: GmpKnowledgeApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:knowledge:view", workspaceId, route: "/api/gmp/projects/[id]/knowledge/records", dependencies });
  if ("error" in access) return access.error;

  const project = await ensureProject(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const d = deps(dependencies);
  const url = new URL(request.url);
  const domain = parseKnowledgeDomain(url.searchParams.get("domain"));
  const includeArchived = url.searchParams.get("includeArchived") === "true";
  const records = await d.knowledgeRepository.listRecords(projectId, {
    domain: domain ?? undefined,
    includeArchived,
  });

  return json({ records });
}

export async function handleGetKnowledgeRecord(request: Request, recordId: string, dependencies?: GmpKnowledgeApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:knowledge:view", workspaceId, route: "/api/gmp/knowledge/records/[recordId]", dependencies });
  if ("error" in access) return access.error;

  const d = deps(dependencies);
  const record = await ensureRecord(recordId, workspaceId, dependencies);
  if (!record) return json({ error: "Knowledge record not found." }, 404);

  const evidence = await d.knowledgeRepository.listEvidenceForRecord(recordId);
  return json({ record, evidence });
}

export async function handleUpdateKnowledgeRecord(request: Request, recordId: string, dependencies?: GmpKnowledgeApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:knowledge:edit_draft", workspaceId, route: "/api/gmp/knowledge/records/[recordId]", dependencies });
  if ("error" in access) return access.error;

  const d = deps(dependencies);
  const record = await ensureRecord(recordId, workspaceId, dependencies);
  if (!record) return json({ error: "Knowledge record not found." }, 404);

  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input) return json({ error: "Request body must be valid JSON." }, 400);

  if (record.reviewState === "APPROVED" && input.forceSupersede !== true) {
    return json({ error: "Approved records cannot be overwritten. Use forceSupersede=true to create a superseding draft." }, 409);
  }

  if (record.reviewState === "APPROVED" && input.forceSupersede === true) {
    const superseding = await d.knowledgeRepository.createRecord({
      projectId: record.projectId,
      knowledgeWorkspaceId: record.knowledgeWorkspaceId,
      domain: parseKnowledgeDomain(input.domain) ?? record.domain,
      recordType: typeof input.recordType === "string" ? input.recordType : record.recordType,
      canonicalKey: typeof input.canonicalKey === "string" ? input.canonicalKey : record.canonicalKey,
      title: typeof input.title === "string" ? input.title : record.title,
      summary: typeof input.summary === "string" ? input.summary : record.summary,
      structuredValue: typeof input.structuredValue === "object" && input.structuredValue !== null
        ? input.structuredValue as Record<string, unknown>
        : record.structuredValue,
      normalizedValue: typeof input.normalizedValue === "object" && input.normalizedValue !== null
        ? input.normalizedValue as Record<string, unknown>
        : record.normalizedValue,
      status: "DRAFT",
      confidence: typeof input.confidence === "number" ? input.confidence : record.confidence,
      priority: typeof input.priority === "number" ? input.priority : record.priority,
      effectiveFrom: record.effectiveFrom,
      effectiveUntil: record.effectiveUntil,
      sourceCount: record.sourceCount,
      conflictState: "NONE",
      reviewState: "DRAFT",
      parentRecordId: record.parentRecordId,
      supersededByRecordId: undefined,
      archivedAt: null,
      metadata: {
        supersedesRecordId: record.knowledgeRecordId,
        createdBy: access.subject.actorId,
      },
    });

    await d.knowledgeRepository.updateRecord(record.knowledgeRecordId, {
      status: "SUPERSEDED",
      supersededByRecordId: superseding.knowledgeRecordId,
    });

    await d.knowledgeRepository.createRecordVersion({
      knowledgeRecordId: superseding.knowledgeRecordId,
      projectId: superseding.projectId,
      knowledgeWorkspaceId: superseding.knowledgeWorkspaceId,
      versionNumber: 1,
      previousValue: {
        supersededRecordId: record.knowledgeRecordId,
      },
      newValue: {
        structuredValue: superseding.structuredValue,
        normalizedValue: superseding.normalizedValue,
      },
      changeReason: typeof input.changeReason === "string" ? input.changeReason : "Created superseding draft",
      changedBy: access.subject.actorId,
      changedAt: new Date().toISOString(),
      sourceImpact: {},
      approvalImpact: { previousApprovalState: record.reviewState },
      metadata: {},
    });

    return json({ record: superseding, supersededRecordId: record.knowledgeRecordId });
  }

  const updated = await d.knowledgeRepository.updateRecord(recordId, {
    domain: parseKnowledgeDomain(input.domain) ?? record.domain,
    recordType: typeof input.recordType === "string" ? input.recordType : record.recordType,
    canonicalKey: typeof input.canonicalKey === "string" ? input.canonicalKey : record.canonicalKey,
    title: typeof input.title === "string" ? input.title : record.title,
    summary: typeof input.summary === "string" ? input.summary : record.summary,
    structuredValue: typeof input.structuredValue === "object" && input.structuredValue !== null
      ? input.structuredValue as Record<string, unknown>
      : record.structuredValue,
    normalizedValue: typeof input.normalizedValue === "object" && input.normalizedValue !== null
      ? input.normalizedValue as Record<string, unknown>
      : record.normalizedValue,
    confidence: typeof input.confidence === "number" ? input.confidence : record.confidence,
    priority: typeof input.priority === "number" ? input.priority : record.priority,
    metadata: {
      ...(record.metadata ?? {}),
      updatedBy: access.subject.actorId,
    },
  });

  if (!updated) return json({ error: "Knowledge record not found." }, 404);

  await d.knowledgeRepository.createRecordVersion({
    knowledgeRecordId: updated.knowledgeRecordId,
    projectId: updated.projectId,
    knowledgeWorkspaceId: updated.knowledgeWorkspaceId,
    versionNumber: updated.version,
    previousValue: {
      structuredValue: record.structuredValue,
      normalizedValue: record.normalizedValue,
      summary: record.summary,
      title: record.title,
    },
    newValue: {
      structuredValue: updated.structuredValue,
      normalizedValue: updated.normalizedValue,
      summary: updated.summary,
      title: updated.title,
    },
    changeReason: typeof input.changeReason === "string" ? input.changeReason : "Record updated",
    changedBy: access.subject.actorId,
    changedAt: new Date().toISOString(),
    sourceImpact: {},
    approvalImpact: {},
    metadata: {},
  });

  return json({ record: updated });
}

export async function handleDeleteKnowledgeRecord(request: Request, recordId: string, dependencies?: GmpKnowledgeApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:knowledge:archive", workspaceId, route: "/api/gmp/knowledge/records/[recordId]", dependencies });
  if ("error" in access) return access.error;

  const record = await ensureRecord(recordId, workspaceId, dependencies);
  if (!record) return json({ error: "Knowledge record not found." }, 404);

  const d = deps(dependencies);
  const archived = await d.knowledgeRepository.archiveRecord(recordId);
  return json({ record: archived });
}

export async function handleGetKnowledgeRecordVersions(request: Request, recordId: string, dependencies?: GmpKnowledgeApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:knowledge:view", workspaceId, route: "/api/gmp/knowledge/records/[recordId]/versions", dependencies });
  if ("error" in access) return access.error;

  const record = await ensureRecord(recordId, workspaceId, dependencies);
  if (!record) return json({ error: "Knowledge record not found." }, 404);

  const d = deps(dependencies);
  const versions = await d.knowledgeRepository.listRecordVersions(recordId);
  return json({ versions });
}

export async function handleSubmitRecordForReview(request: Request, recordId: string, dependencies?: GmpKnowledgeApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:knowledge:submit_review", workspaceId, route: "/api/gmp/knowledge/records/[recordId]/review", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const notes = body && typeof body.notes === "string" ? body.notes : undefined;

  const d = deps(dependencies);
  const updated = await d.knowledgeServices.submitRecordForReview(recordId, access.subject.actorId, notes);
  if (!updated) return json({ error: "Knowledge record not found." }, 404);
  return json({ record: updated });
}

export async function handleApproveRecord(request: Request, recordId: string, dependencies?: GmpKnowledgeApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:knowledge:approve", workspaceId, route: "/api/gmp/knowledge/records/[recordId]/approve", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const notes = body && typeof body.notes === "string" ? body.notes : undefined;

  const d = deps(dependencies);
  const updated = await d.knowledgeServices.approveRecord(recordId, access.subject.actorId, notes);
  if (!updated) return json({ error: "Knowledge record not found." }, 404);
  return json({ record: updated });
}

export async function handleRejectRecord(request: Request, recordId: string, dependencies?: GmpKnowledgeApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:knowledge:reject", workspaceId, route: "/api/gmp/knowledge/records/[recordId]/reject", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const notes = body && typeof body.notes === "string" ? body.notes : undefined;

  const d = deps(dependencies);
  const updated = await d.knowledgeServices.rejectRecord(recordId, access.subject.actorId, notes);
  if (!updated) return json({ error: "Knowledge record not found." }, 404);
  return json({ record: updated });
}

export async function handleCreateKnowledgeSource(request: Request, projectId: string, dependencies?: GmpKnowledgeApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:knowledge:manage_sources", workspaceId, route: "/api/gmp/projects/[id]/knowledge/sources", dependencies });
  if ("error" in access) return access.error;

  const project = await ensureProject(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "Request body must be valid JSON." }, 400);

  const sourceType = parseKnowledgeSourceType(body.sourceType);
  if (!sourceType) {
    return json({ error: "Unsupported sourceType." }, 400);
  }
  if (typeof body.displayName !== "string" || body.displayName.trim().length < 2) {
    return json({ error: "displayName is required." }, 400);
  }

  const d = deps(dependencies);
  const source = await d.knowledgeRepository.createSource({
    projectId,
    sourceType,
    displayName: body.displayName,
    locationReference: typeof body.locationReference === "string" ? body.locationReference : undefined,
    externalIdentifier: typeof body.externalIdentifier === "string" ? body.externalIdentifier : undefined,
    checksum: typeof body.checksum === "string" ? body.checksum : undefined,
    sourceVersion: typeof body.sourceVersion === "string" ? body.sourceVersion : undefined,
    capturedAt: typeof body.capturedAt === "string" ? body.capturedAt : null,
    metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata as Record<string, unknown> : undefined,
  });

  return json({ source }, 201);
}

export async function handleListKnowledgeSources(request: Request, projectId: string, dependencies?: GmpKnowledgeApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:knowledge:view", workspaceId, route: "/api/gmp/projects/[id]/knowledge/sources", dependencies });
  if ("error" in access) return access.error;

  const project = await ensureProject(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const d = deps(dependencies);
  const sources = await d.knowledgeRepository.listSources(projectId);
  return json({ sources });
}

export async function handleCreateEvidenceLink(request: Request, recordId: string, dependencies?: GmpKnowledgeApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:knowledge:manage_sources", workspaceId, route: "/api/gmp/knowledge/records/[recordId]/evidence", dependencies });
  if ("error" in access) return access.error;

  const record = await ensureRecord(recordId, workspaceId, dependencies);
  if (!record) return json({ error: "Knowledge record not found." }, 404);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.sourceId !== "string") {
    return json({ error: "sourceId is required." }, 400);
  }

  const d = deps(dependencies);
  const source = (await d.knowledgeRepository.listSources(record.projectId)).find((entry) => entry.sourceId === body.sourceId);
  if (!source) {
    return json({ error: "Source not found." }, 404);
  }

  const link = await d.knowledgeRepository.createEvidenceLink({
    projectId: record.projectId,
    knowledgeRecordId: recordId,
    sourceId: source.sourceId,
    evidenceLocation: typeof body.evidenceLocation === "string" ? body.evidenceLocation : undefined,
    evidenceSummary: typeof body.evidenceSummary === "string" ? body.evidenceSummary : undefined,
    extractionMethod: typeof body.extractionMethod === "string" ? body.extractionMethod : "manual",
    confidence: typeof body.confidence === "number" ? body.confidence : 50,
    verifiedBy: access.subject.actorId,
    verifiedAt: new Date().toISOString(),
    metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata as Record<string, unknown> : undefined,
  });

  await d.knowledgeRepository.updateRecord(record.knowledgeRecordId, {
    sourceCount: record.sourceCount + 1,
  });

  return json({ evidence: link }, 201);
}

export async function handleListKnowledgeConflicts(request: Request, projectId: string, dependencies?: GmpKnowledgeApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:knowledge:view", workspaceId, route: "/api/gmp/projects/[id]/knowledge/conflicts", dependencies });
  if ("error" in access) return access.error;

  const project = await ensureProject(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const d = deps(dependencies);
  const conflicts = await d.knowledgeRepository.listConflicts(projectId);
  return json({ conflicts });
}

export async function handleResolveKnowledgeConflict(request: Request, conflictId: string, dependencies?: GmpKnowledgeApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:knowledge:resolve_conflicts", workspaceId, route: "/api/gmp/knowledge/conflicts/[conflictId]/resolve", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const d = deps(dependencies);

  const resolved = await d.knowledgeRepository.resolveConflict(conflictId, {
    selectedRecordId: body && typeof body.selectedRecordId === "string" ? body.selectedRecordId : undefined,
    resolutionNotes: body && typeof body.resolutionNotes === "string" ? body.resolutionNotes : undefined,
    resolvedBy: access.subject.actorId,
  });

  if (!resolved) return json({ error: "Conflict not found." }, 404);

  return json({ conflict: resolved });
}

export async function handleGetCompleteness(request: Request, projectId: string, dependencies?: GmpKnowledgeApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:knowledge:view", workspaceId, route: "/api/gmp/projects/[id]/knowledge/completeness", dependencies });
  if ("error" in access) return access.error;

  const project = await ensureProject(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const d = deps(dependencies);
  const latest = await d.knowledgeRepository.getLatestCompletenessAssessment(projectId);
  return json({ completeness: latest });
}

export async function handleRunCompleteness(request: Request, projectId: string, dependencies?: GmpKnowledgeApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:knowledge:run_completeness", workspaceId, route: "/api/gmp/projects/[id]/knowledge/completeness/run", dependencies });
  if ("error" in access) return access.error;

  const project = await ensureProject(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const d = deps(dependencies);
  const conflicts = await d.knowledgeServices.runConflictScan(projectId, access.subject.actorId);
  const completeness = await d.knowledgeServices.runCompletenessAssessment(projectId, access.subject.actorId);
  return json({ completeness, conflictCount: conflicts.length }, 201);
}

export async function handleAssembleContext(request: Request, projectId: string, dependencies?: GmpKnowledgeApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const previewMode = body?.previewMode === true;

  const access = await authorize({
    actionId: previewMode ? "gmp:knowledge:preview_unapproved" : "gmp:knowledge:assemble_context",
    workspaceId,
    route: "/api/gmp/projects/[id]/knowledge/context/assemble",
    dependencies,
  });
  if ("error" in access) return access.error;

  const project = await ensureProject(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const d = deps(dependencies);
  const context = await d.knowledgeServices.assembleContext({
    projectId,
    actorId: access.subject.actorId,
    siteId: body && typeof body.siteId === "string" ? body.siteId : undefined,
    operationType: body && typeof body.operationType === "string" ? body.operationType : "PROJECT",
    previewMode,
    inputMetadata: body && typeof body.inputMetadata === "object" && body.inputMetadata !== null
      ? body.inputMetadata as Record<string, unknown>
      : undefined,
  });

  return json({ context }, 201);
}
