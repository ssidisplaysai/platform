import { describe, expect, it } from "@jest/globals";
import { createEnterpriseRegistryValidationEngine } from "@/platform/ear";
import { makeRegistration } from "./fixtures";

describe("EAR validation engine", () => {
  it("rejects duplicate IDs and invalid semantic versions", () => {
    const validation = createEnterpriseRegistryValidationEngine();
    const registration = {
      ...makeRegistration({
        version: { version: "invalid" },
      }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = validation.validateRegistration(registration, { existingApplicationIds: ["sample-app"] });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "DUPLICATE")).toBe(true);
    expect(result.issues.some((issue) => issue.field === "version.version")).toBe(true);
  });

  it("rejects invalid lifecycle transitions", () => {
    const validation = createEnterpriseRegistryValidationEngine();
    const result = validation.validateLifecycleTransition("DEPRECATED", "ACTIVE");
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe("INVALID_TRANSITION");
  });
});
