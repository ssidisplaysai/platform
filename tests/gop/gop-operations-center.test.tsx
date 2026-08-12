import { describe, expect, it } from "@jest/globals";
import { createEmptyOperationsSnapshot } from "@/components/gop/gop-operations-center";

describe("gop operations center", () => {
  it("builds a safe empty snapshot bootstrap state", () => {
    const snapshot = createEmptyOperationsSnapshot();

    expect(snapshot.workspaceId).toBe("glw-led-display-warehouse");
    expect(snapshot.queue.depth).toBe(0);
    expect(snapshot.executions).toHaveLength(0);
    expect(snapshot.notifications).toHaveLength(0);
    expect(snapshot.failedExecutions).toHaveLength(0);
  });
});
