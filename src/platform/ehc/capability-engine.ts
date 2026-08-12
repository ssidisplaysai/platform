import type { CapabilityAdvertisement, CapabilityStatus } from "./types";

export type EnterpriseCapabilityEngine = {
  buildAdvertisement: (declared: string[], available: string[]) => CapabilityAdvertisement;
};

export function createEnterpriseCapabilityEngine(): EnterpriseCapabilityEngine {
  return {
    buildAdvertisement(declared, available) {
      const declaredNormalized = [...new Set(declared.map((entry) => entry.trim()).filter(Boolean))];
      const availableSet = new Set(available.map((entry) => entry.trim()).filter(Boolean));

      const statuses: CapabilityStatus[] = declaredNormalized.map((capability) => ({
        capability,
        availability: availableSet.has(capability) ? "AVAILABLE" : "UNAVAILABLE",
        reason: availableSet.has(capability) ? undefined : "Capability not available in latest evaluation.",
      }));

      const availableCapabilities = statuses.filter((status) => status.availability === "AVAILABLE").map((status) => status.capability);
      const unavailableCapabilities = statuses.filter((status) => status.availability === "UNAVAILABLE").map((status) => status.capability);

      return {
        declaredCapabilities: declaredNormalized,
        availableCapabilities,
        unavailableCapabilities,
        statuses,
      };
    },
  };
}
