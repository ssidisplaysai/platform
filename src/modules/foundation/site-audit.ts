import type { SiteActivityRecord, SiteActivityType } from "./types";

const siteActivityStore: SiteActivityRecord[] = [];

function createActivityId(siteId: string, type: SiteActivityType): string {
  return `${siteId}-${type}-${Date.now()}`;
}

export function recordSiteActivity(input: {
  siteId: string;
  organizationId: string;
  type: SiteActivityType;
  actor: string;
  summary: string;
}): SiteActivityRecord {
  const entry: SiteActivityRecord = {
    activityId: createActivityId(input.siteId, input.type),
    siteId: input.siteId,
    organizationId: input.organizationId,
    type: input.type,
    actor: input.actor,
    createdAt: new Date().toISOString(),
    summary: input.summary,
  };

  siteActivityStore.unshift(entry);
  return entry;
}

export function listSiteActivity(siteId: string): readonly SiteActivityRecord[] {
  return siteActivityStore.filter((entry) => entry.siteId === siteId);
}
