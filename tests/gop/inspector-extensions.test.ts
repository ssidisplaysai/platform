import { describe, expect, it, beforeEach } from "@jest/globals";
import {
  clearGenesisInspectorExtensionsForTests,
  getGenesisInspectorExtensions,
  registerGenesisInspectorExtension,
} from "@/platform/gop/inspector/extensions";

describe("gop inspector extensions", () => {
  beforeEach(() => {
    clearGenesisInspectorExtensionsForTests();
  });

  it("registers and orders module extensions", () => {
    registerGenesisInspectorExtension({
      extensionId: "b",
      moduleId: "glw.core",
      order: 20,
      renderSection: () => null,
    });

    registerGenesisInspectorExtension({
      extensionId: "a",
      moduleId: "glw.core",
      order: 10,
      renderSection: () => null,
    });

    const extensions = getGenesisInspectorExtensions("glw.core");
    expect(extensions.map((item) => item.extensionId)).toEqual(["a", "b"]);
  });
});
