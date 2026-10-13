import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { deepClone, loadPersistedState, savePersistedState } from "./foundation-persistence";

export type SitePublicationOperationKind = "PUBLISH_PAGE" | "VERIFY_NAVIGATION" | "SET_STATIC_FRONT_PAGE" | "VERIFY_MEDIA" | "VERIFY_SEO" | "TRANSITION_GENESIS_SITE" | "FINAL_VERIFICATION";
export type SitePublicationOperation = { operationId: string; kind: SitePublicationOperationKind; label: string; targetId: string; currentState: string; intendedState: string; mutation: boolean; status: "PENDING" | "SUCCEEDED" | "FAILED"; attemptCount: number; idempotencyKey: string; completedAt: string | null; error: string | null };
export type SitePublicationExecutionPlan = { executionPlanId: string; organizationId: string; siteId: string; buildSessionId: string; authorizationReviewId: string; fingerprint: string; status: "READY_FOR_EXECUTION" | "EXECUTING" | "PARTIALLY_FAILED" | "VERIFYING" | "VERIFIED"; operations: SitePublicationOperation[]; createdAt: string; updatedAt: string };
type State = { plans: SitePublicationExecutionPlan[] };
const NAMESPACE = "site-publication-execution-repository";
const load = () => loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: () => ({ plans: [] }) });
export const createSitePublicationExecutionFingerprint = (operations: Array<Pick<SitePublicationOperation, "kind" | "label" | "targetId" | "intendedState" | "mutation" | "idempotencyKey">>) => createHash("sha256").update(JSON.stringify(operations.map((operation) => ({ kind: operation.kind, label: operation.label, targetId: operation.targetId, intendedState: operation.intendedState, mutation: operation.mutation, idempotencyKey: operation.idempotencyKey })))).digest("hex");

export function listSitePublicationExecutionPlans(input: { organizationId: string; siteId: string; buildSessionId: string }): SitePublicationExecutionPlan[] { return deepClone(load().state.plans.filter((plan) => plan.organizationId === input.organizationId && plan.siteId === input.siteId && plan.buildSessionId === input.buildSessionId)); }
export function saveSitePublicationExecutionPlan(input: { organizationId: string; siteId: string; buildSessionId: string; authorizationReviewId: string; operations: Array<Omit<SitePublicationOperation, "operationId" | "status" | "attemptCount" | "completedAt" | "error">> }): SitePublicationExecutionPlan {
  const loaded = load();
  const operations = input.operations.map((operation) => ({ ...operation, operationId: `publication-operation-${randomUUID()}`, status: "PENDING" as const, attemptCount: 0, completedAt: null, error: null }));
  const planFingerprint = createSitePublicationExecutionFingerprint(operations);
  const existing = loaded.state.plans.find((plan) => plan.organizationId === input.organizationId && plan.siteId === input.siteId && plan.buildSessionId === input.buildSessionId && plan.authorizationReviewId === input.authorizationReviewId && plan.fingerprint === planFingerprint);
  if (existing) return deepClone(existing);
  const timestamp = new Date().toISOString();
  const plan: SitePublicationExecutionPlan = { executionPlanId: `site-publication-${randomUUID()}`, organizationId: input.organizationId, siteId: input.siteId, buildSessionId: input.buildSessionId, authorizationReviewId: input.authorizationReviewId, fingerprint: planFingerprint, status: "READY_FOR_EXECUTION", operations, createdAt: timestamp, updatedAt: timestamp };
  loaded.state.plans.push(plan); savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision }); return deepClone(plan);
}
export function checkpointSitePublicationExecutionPlan(input: { executionPlanId: string; status: SitePublicationExecutionPlan["status"]; operations: SitePublicationOperation[] }): SitePublicationExecutionPlan {
  const loaded = load(); const index = loaded.state.plans.findIndex((plan) => plan.executionPlanId === input.executionPlanId); const current = loaded.state.plans[index];
  if (!current || input.operations.length !== current.operations.length || input.operations.some((operation, operationIndex) => operation.operationId !== current.operations[operationIndex].operationId || operation.idempotencyKey !== current.operations[operationIndex].idempotencyKey)) throw new Error("PUBLICATION_EXECUTION_IDENTITY_MISMATCH");
  loaded.state.plans[index] = { ...current, status: input.status, operations: deepClone(input.operations), updatedAt: new Date().toISOString() }; savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision }); return deepClone(loaded.state.plans[index]);
}
