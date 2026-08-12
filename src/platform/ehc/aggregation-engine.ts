import type {
  EnterpriseHealthRecord,
  HealthAggregation,
  LivenessStatus,
  PerCapabilityHealth,
  ReadinessStatus,
} from "./types";

function aggregateEnterpriseState(records: EnterpriseHealthRecord[]): HealthAggregation["enterpriseState"] {
  if (records.some((record) => record.status.state === "UNAVAILABLE")) {
    return "UNAVAILABLE";
  }

  if (records.some((record) => record.status.state === "DEGRADED")) {
    return "DEGRADED";
  }

  if (records.some((record) => record.status.state === "WARNING")) {
    return "WARNING";
  }

  if (records.some((record) => record.status.state === "UNKNOWN")) {
    return "UNKNOWN";
  }

  return "HEALTHY";
}

function aggregateReadiness(records: EnterpriseHealthRecord[]): ReadinessStatus {
  if (records.length === 0) {
    return "UNKNOWN";
  }

  if (records.some((record) => record.status.readiness === "NOT_READY")) {
    return "NOT_READY";
  }

  if (records.some((record) => record.status.readiness === "UNKNOWN")) {
    return "UNKNOWN";
  }

  return "READY";
}

function aggregateAvailability(records: EnterpriseHealthRecord[]): LivenessStatus {
  if (records.length === 0) {
    return "UNKNOWN";
  }

  if (records.some((record) => record.status.liveness === "NOT_LIVE")) {
    return "NOT_LIVE";
  }

  if (records.some((record) => record.status.liveness === "UNKNOWN")) {
    return "UNKNOWN";
  }

  return "LIVE";
}

function countByCapability(records: EnterpriseHealthRecord[]): PerCapabilityHealth[] {
  const map = new Map<string, PerCapabilityHealth>();

  for (const record of records) {
    for (const capability of record.capabilities.statuses) {
      if (!map.has(capability.capability)) {
        map.set(capability.capability, {
          capability: capability.capability,
          healthy: 0,
          warning: 0,
          degraded: 0,
          unavailable: 0,
          unknown: 0,
        });
      }

      const entry = map.get(capability.capability)!;
      switch (record.status.state) {
        case "HEALTHY":
          entry.healthy += 1;
          break;
        case "WARNING":
          entry.warning += 1;
          break;
        case "DEGRADED":
          entry.degraded += 1;
          break;
        case "UNAVAILABLE":
          entry.unavailable += 1;
          break;
        default:
          entry.unknown += 1;
          break;
      }
    }
  }

  return [...map.values()].sort((left, right) => left.capability.localeCompare(right.capability));
}

export type EnterpriseAggregationEngine = {
  aggregate: (records: EnterpriseHealthRecord[]) => HealthAggregation;
};

export function createEnterpriseAggregationEngine(): EnterpriseAggregationEngine {
  return {
    aggregate(records) {
      const totals = {
        total: records.length,
        healthy: records.filter((record) => record.status.state === "HEALTHY").length,
        warning: records.filter((record) => record.status.state === "WARNING").length,
        degraded: records.filter((record) => record.status.state === "DEGRADED").length,
        unavailable: records.filter((record) => record.status.state === "UNAVAILABLE").length,
        unknown: records.filter((record) => record.status.state === "UNKNOWN").length,
      };

      return {
        aggregatedAt: new Date().toISOString(),
        enterpriseState: aggregateEnterpriseState(records),
        enterpriseReadiness: aggregateReadiness(records),
        enterpriseAvailability: aggregateAvailability(records),
        applications: totals,
        compatibility: {
          compatible: records.filter((record) => record.compatibility.compatible).length,
          incompatible: records.filter((record) => !record.compatibility.compatible).length,
        },
        perApplication: records.map((record) => ({
          applicationId: record.applicationId,
          state: record.status.state,
          readiness: record.status.readiness,
          liveness: record.status.liveness,
        })),
        perCapability: countByCapability(records),
      };
    },
  };
}
