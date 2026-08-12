import type { EnterpriseHealthRecord, HealthAggregation, HealthEvent, HealthSnapshot } from "./types";

export type EnterpriseHealthRepository = {
  createRecord: (record: EnterpriseHealthRecord) => Promise<EnterpriseHealthRecord>;
  updateCurrent: (record: EnterpriseHealthRecord) => Promise<EnterpriseHealthRecord>;
  retrieveCurrent: (applicationId: string) => Promise<EnterpriseHealthRecord | null>;
  retrieveAllCurrent: () => Promise<EnterpriseHealthRecord[]>;
  retrieveHistory: (applicationId: string, limit?: number) => Promise<EnterpriseHealthRecord[]>;
  appendEvent: (event: HealthEvent) => Promise<HealthEvent>;
  retrieveEvents: (applicationId: string, limit?: number) => Promise<HealthEvent[]>;
  saveSnapshot: (snapshot: HealthSnapshot) => Promise<HealthSnapshot>;
  retrieveLatestSnapshot: (applicationId: string) => Promise<HealthSnapshot | null>;
  saveAggregation: (aggregation: HealthAggregation) => Promise<HealthAggregation>;
  retrieveLatestAggregation: () => Promise<HealthAggregation | null>;
};

function cloneRecord(record: EnterpriseHealthRecord): EnterpriseHealthRecord {
  return {
    ...record,
    status: { ...record.status },
    capabilities: {
      ...record.capabilities,
      declaredCapabilities: [...record.capabilities.declaredCapabilities],
      availableCapabilities: [...record.capabilities.availableCapabilities],
      unavailableCapabilities: [...record.capabilities.unavailableCapabilities],
      statuses: record.capabilities.statuses.map((status) => ({ ...status })),
    },
    compatibility: { ...record.compatibility, issues: [...record.compatibility.issues] },
    reference: { ...record.reference },
  };
}

function cloneAggregation(aggregation: HealthAggregation): HealthAggregation {
  return {
    ...aggregation,
    applications: { ...aggregation.applications },
    compatibility: { ...aggregation.compatibility },
    perApplication: aggregation.perApplication.map((entry) => ({ ...entry })),
    perCapability: aggregation.perCapability.map((entry) => ({ ...entry })),
  };
}

export function createInMemoryEnterpriseHealthRepository(): EnterpriseHealthRepository {
  const current = new Map<string, EnterpriseHealthRecord>();
  const history = new Map<string, EnterpriseHealthRecord[]>();
  const events = new Map<string, HealthEvent[]>();
  const snapshots = new Map<string, HealthSnapshot[]>();
  const aggregations: HealthAggregation[] = [];

  return {
    async createRecord(record) {
      const cloned = cloneRecord(record);
      current.set(cloned.applicationId, cloned);
      history.set(cloned.applicationId, [...(history.get(cloned.applicationId) ?? []), cloned]);
      return cloneRecord(cloned);
    },

    async updateCurrent(record) {
      const cloned = cloneRecord(record);
      current.set(cloned.applicationId, cloned);
      history.set(cloned.applicationId, [...(history.get(cloned.applicationId) ?? []), cloned]);
      return cloneRecord(cloned);
    },

    async retrieveCurrent(applicationId) {
      const found = current.get(applicationId);
      return found ? cloneRecord(found) : null;
    },

    async retrieveAllCurrent() {
      return [...current.values()].map(cloneRecord);
    },

    async retrieveHistory(applicationId, limit = 100) {
      const found = history.get(applicationId) ?? [];
      return [...found].slice(-Math.max(1, limit)).map(cloneRecord);
    },

    async appendEvent(event) {
      events.set(event.applicationId, [...(events.get(event.applicationId) ?? []), { ...event }]);
      return { ...event };
    },

    async retrieveEvents(applicationId, limit = 100) {
      const found = events.get(applicationId) ?? [];
      return [...found].slice(-Math.max(1, limit)).map((event) => ({ ...event }));
    },

    async saveSnapshot(snapshot) {
      snapshots.set(snapshot.applicationId, [...(snapshots.get(snapshot.applicationId) ?? []), {
        ...snapshot,
        record: cloneRecord(snapshot.record),
      }]);

      return {
        ...snapshot,
        record: cloneRecord(snapshot.record),
      };
    },

    async retrieveLatestSnapshot(applicationId) {
      const found = snapshots.get(applicationId) ?? [];
      if (found.length === 0) {
        return null;
      }

      const latest = found[found.length - 1];
      return { ...latest, record: cloneRecord(latest.record) };
    },

    async saveAggregation(aggregation) {
      const cloned = cloneAggregation(aggregation);
      aggregations.push(cloned);
      return cloneAggregation(cloned);
    },

    async retrieveLatestAggregation() {
      if (aggregations.length === 0) {
        return null;
      }

      return cloneAggregation(aggregations[aggregations.length - 1]);
    },
  };
}
