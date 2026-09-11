import { randomUUID } from "node:crypto";

import { deepClone, loadPersistedState, savePersistedState } from "./foundation-persistence";
import type { GenerationAuthoritySnapshot, GenerationReadinessResult } from "./site-generation-readiness";

export type SiteGenerationReadinessCertification = GenerationAuthoritySnapshot & {
  certificationId: string;
  revision: number;
  organizationId: string;
  siteId: string;
  certifiedAt: string;
  certifiedBy: string;
};

export type SiteBuildSession = {
  buildSessionId: string;
  organizationId: string;
  siteId: string;
  certificationId: string;
  state: "STARTED";
  startedAt: string;
  startedBy: string;
};

type State = {
  certifications: SiteGenerationReadinessCertification[];
  buildSessions: SiteBuildSession[];
};

const NAMESPACE = "site-generation-readiness-repository";
const seed = (): State => ({ certifications: [], buildSessions: [] });

function sameSnapshot(left: GenerationAuthoritySnapshot, right: GenerationAuthoritySnapshot): boolean {
  return left.strategyRevision === right.strategyRevision
    && left.creativeRevision === right.creativeRevision
    && left.marketFingerprint === right.marketFingerprint
    && left.capabilityFingerprint === right.capabilityFingerprint
    && left.productServiceFingerprint === right.productServiceFingerprint
    && left.sourcesFingerprint === right.sourcesFingerprint
    && left.generationPolicyVersion === right.generationPolicyVersion;
}

export function getGenerationCertification(input: { organizationId: string; siteId: string; snapshot: GenerationAuthoritySnapshot }) {
  const records = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed }).state.certifications
    .filter((item) => item.organizationId === input.organizationId && item.siteId === input.siteId);
  const certification = records.at(-1) ?? null;
  return deepClone({ certification, status: certification ? sameSnapshot(certification, input.snapshot) ? "CURRENT" as const : "STALE" as const : "NOT_CERTIFIED" as const });
}

export function certifyGenerationReadiness(input: { organizationId: string; siteId: string; actor: string; readiness: GenerationReadinessResult }): SiteGenerationReadinessCertification {
  if (!input.readiness.readyToCertify) throw new Error("GENERATION_READINESS_BLOCKED");
  const loaded = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed });
  const prior = loaded.state.certifications.filter((item) => item.organizationId === input.organizationId && item.siteId === input.siteId);
  const timestamp = new Date().toISOString();
  const certification: SiteGenerationReadinessCertification = {
    certificationId: `generation-readiness-${randomUUID()}`,
    revision: (prior.at(-1)?.revision ?? 0) + 1,
    organizationId: input.organizationId,
    siteId: input.siteId,
    certifiedAt: timestamp,
    certifiedBy: input.actor,
    ...input.readiness.snapshot,
  };
  loaded.state.certifications.push(certification);
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(certification);
}

export function getSiteBuildSession(input: { organizationId: string; siteId: string }): SiteBuildSession | null {
  const sessions = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed }).state.buildSessions;
  return deepClone(sessions.filter((item) => item.organizationId === input.organizationId && item.siteId === input.siteId).at(-1) ?? null);
}

export function startSiteBuild(input: { organizationId: string; siteId: string; actor: string; certification: SiteGenerationReadinessCertification }): SiteBuildSession {
  const loaded = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed });
  const existing = loaded.state.buildSessions.find((item) => item.organizationId === input.organizationId && item.siteId === input.siteId && item.certificationId === input.certification.certificationId);
  if (existing) return deepClone(existing);
  const session: SiteBuildSession = { buildSessionId: `site-build-${randomUUID()}`, organizationId: input.organizationId, siteId: input.siteId, certificationId: input.certification.certificationId, state: "STARTED", startedAt: new Date().toISOString(), startedBy: input.actor };
  loaded.state.buildSessions.push(session);
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(session);
}