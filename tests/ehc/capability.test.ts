import { describe, expect, it } from "@jest/globals";
import { createEnterpriseCapabilityEngine } from "@/platform/ehc";

describe("EHC capability engine", () => {
  it("advertises declared, available, and unavailable capabilities", () => {
    const engine = createEnterpriseCapabilityEngine();
    const advertisement = engine.buildAdvertisement(["capability-a", "capability-b"], ["capability-a"]);

    expect(advertisement.declaredCapabilities).toEqual(["capability-a", "capability-b"]);
    expect(advertisement.availableCapabilities).toEqual(["capability-a"]);
    expect(advertisement.unavailableCapabilities).toEqual(["capability-b"]);
  });
});
