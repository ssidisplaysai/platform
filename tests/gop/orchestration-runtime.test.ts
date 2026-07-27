import { beforeEach, describe, expect, it } from "@jest/globals";
import {
  createGenesisOrchestrationRuntime,
  createGenesisQueueManager,
  createGenesisExecution,
  transitionExecutionStatus,
  addExecutionRetry,
  buildParallelWorkflowGraph,
  evaluateReadyNodes,
} from "@/platform/gop";

describe("gop orchestration runtime", () => {
  beforeEach(() => {
    // No global runtime singleton usage in this test file.
  });

  it("creates and advances a GLW execution lifecycle", () => {
    const runtime = createGenesisOrchestrationRuntime();

    const created = runtime.createGlwExecutionForJob({
      jobId: "job_1",
      jobType: "PAGE_GENERATION",
      title: "Test Job",
      siteId: "led-display-warehouse",
    });

    expect(created.status).toBe("QUEUED");

    const running = runtime.syncGlwExecutionState({
      jobId: "job_1",
      status: "RUNNING",
      correlationId: "exec_001",
    });

    expect(running?.status).toBe("RUNNING");
    expect(running?.correlationId).toBe("exec_001");

    const complete = runtime.syncGlwExecutionState({
      jobId: "job_1",
      status: "COMPLETE",
      correlationId: "exec_001",
      result: { wordpressUrl: "https://example.com/draft" },
    });

    expect(complete?.status).toBe("SUCCEEDED");
    expect(complete?.output?.wordpressUrl).toBe("https://example.com/draft");
  });

  it("supports queue pause and resume", () => {
    const queue = createGenesisQueueManager();

    queue.enqueue({
      executionId: "gexec_1",
      workspaceId: "glw-led-display-warehouse",
      moduleId: "glw.core",
      workerType: "ai",
      executionClass: "AUTOMATED",
      priority: "NORMAL",
    });

    queue.pause();
    expect(queue.dequeue("ai")).toBeNull();

    queue.resume();
    expect(queue.dequeue("ai")?.executionId).toBe("gexec_1");
  });

  it("tracks retries and terminal timing in execution engine", () => {
    const base = createGenesisExecution({
      workspaceId: "glw-led-display-warehouse",
      moduleId: "glw.core",
      jobType: "PAGE_GENERATION",
    });

    const running = transitionExecutionStatus(base, "RUNNING");
    const retrying = addExecutionRetry(running, "Transient worker timeout");
    const failed = transitionExecutionStatus(retrying, "FAILED");

    expect(retrying.retryHistory).toHaveLength(1);
    expect(retrying.metrics.retries).toBe(1);
    expect(failed.timing.completedAt).toBeDefined();
  });

  it("builds and evaluates workflow dependency graphs", () => {
    const graph = buildParallelWorkflowGraph("graph:test", {
      root: { stepId: "root", label: "Root", nodeType: "VALIDATION" },
      branches: [
        { stepId: "branchA", label: "Branch A", nodeType: "AI" },
        { stepId: "branchB", label: "Branch B", nodeType: "DATABASE" },
      ],
      join: { stepId: "join", label: "Join", nodeType: "NOTIFICATION" },
    });

    const readyAtStart = evaluateReadyNodes(graph, []);
    expect(readyAtStart.map((node) => node.nodeId)).toEqual(["root"]);

    const readyAfterRoot = evaluateReadyNodes(graph, ["root"]);
    expect(readyAfterRoot.map((node) => node.nodeId).sort()).toEqual(["branchA", "branchB"]);
  });

  it("supports manual approval flow", () => {
    const runtime = createGenesisOrchestrationRuntime();
    const execution = runtime.createGlwExecutionForJob({
      jobId: "job_approval",
      jobType: "PAGE_GENERATION",
      title: "Approval Flow",
      siteId: "led-display-warehouse",
    });

    runtime.syncGlwExecutionState({
      jobId: "job_approval",
      status: "RUNNING",
    });

    const waiting = runtime.requestManualApproval(execution.executionId, "Awaiting manager signoff");
    expect(waiting?.approvalRequired).toBe(true);
    expect(waiting?.status).toBe("WAITING");

    const resumed = runtime.resolveManualApproval(execution.executionId);
    expect(resumed?.approvalRequired).toBe(false);
    expect(resumed?.status).toBe("RUNNING");
  });
});
