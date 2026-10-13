import "server-only";

import { randomUUID } from "node:crypto";
import { deepClone, loadPersistedState, savePersistedState } from "./foundation-persistence";
import type { SiteNavigationItem } from "./site-page-generation";

export type SiteNavigationReview = {
  navigationReviewId: string;
  organizationId: string;
  siteId: string;
  buildSessionId: string;
  assemblyId: string;
  revision: number;
  status: "READY_FOR_OWNER_REVIEW" | "APPROVED" | "REVISION_REQUESTED" | "PUBLICATION_READINESS_CONFIRMED" | "PUBLICATION_AUTHORIZED";
  items: SiteNavigationItem[];
  footerLinks: Array<{ label: string; href: string }>;
  ownerInstructions: string | null;
  createdAt: string;
  createdBy: string;
  decidedAt: string | null;
  decidedBy: string | null;
};

type State = { records: SiteNavigationReview[] };
const NAMESPACE = "site-navigation-review-repository";
const load = () => loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: () => ({ records: [] }) });

export function listSiteNavigationReviews(input: { organizationId: string; siteId: string; buildSessionId: string }): SiteNavigationReview[] {
  return deepClone(load().state.records.filter((item) => item.organizationId === input.organizationId && item.siteId === input.siteId && item.buildSessionId === input.buildSessionId));
}

export function saveSiteNavigationReview(input: Omit<SiteNavigationReview, "navigationReviewId" | "revision" | "createdAt" | "decidedAt" | "decidedBy">): SiteNavigationReview {
  const loaded = load();
  const prior = loaded.state.records.filter((item) => item.organizationId === input.organizationId && item.siteId === input.siteId && item.buildSessionId === input.buildSessionId);
  const record: SiteNavigationReview = { ...input, navigationReviewId: `site-navigation-${randomUUID()}`, revision: (prior.at(-1)?.revision ?? 0) + 1, createdAt: new Date().toISOString(), decidedAt: null, decidedBy: null };
  loaded.state.records.push(record);
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(record);
}

export function decideSiteNavigationReview(input: { organizationId: string; siteId: string; buildSessionId: string; navigationReviewId: string; decision: "APPROVE" | "REQUEST_CHANGES"; actor: string }): SiteNavigationReview {
  const loaded = load();
  const index = loaded.state.records.findIndex((item) => item.organizationId === input.organizationId && item.siteId === input.siteId && item.buildSessionId === input.buildSessionId && item.navigationReviewId === input.navigationReviewId);
  if (index < 0 || loaded.state.records[index].status !== "READY_FOR_OWNER_REVIEW") throw new Error("NAVIGATION_REVIEW_NOT_REVIEWABLE");
  loaded.state.records[index] = { ...loaded.state.records[index], status: input.decision === "APPROVE" ? "APPROVED" : "REVISION_REQUESTED", decidedAt: new Date().toISOString(), decidedBy: input.actor };
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(loaded.state.records[index]);
}

export function advanceSiteNavigationPublicationGate(input: { organizationId: string; siteId: string; buildSessionId: string; navigationReviewId: string; transition: "CONFIRM_READINESS" | "AUTHORIZE_PUBLICATION"; actor: string }): SiteNavigationReview {
  const loaded = load();
  const index = loaded.state.records.findIndex((item) => item.organizationId === input.organizationId && item.siteId === input.siteId && item.buildSessionId === input.buildSessionId && item.navigationReviewId === input.navigationReviewId);
  const current = loaded.state.records[index];
  const expected = input.transition === "CONFIRM_READINESS" ? "APPROVED" : "PUBLICATION_READINESS_CONFIRMED";
  if (!current || current.status !== expected) throw new Error("PUBLICATION_GATE_TRANSITION_NOT_ALLOWED");
  loaded.state.records[index] = { ...current, status: input.transition === "CONFIRM_READINESS" ? "PUBLICATION_READINESS_CONFIRMED" : "PUBLICATION_AUTHORIZED", decidedAt: new Date().toISOString(), decidedBy: input.actor };
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(loaded.state.records[index]);
}
