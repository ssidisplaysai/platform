import React from "react";
import Link from "next/link";
import { createSeedAgent, createInMemoryGeaRepository } from "@/lib/gea/agent-repository";
import { createAgentRuntimeService } from "@/lib/gea/agent-runtime";
import { geaId, nowIso } from "@/lib/gea/agent-models";
import { createPrismaOrchestrationRepository } from "@/lib/gea/orchestration-repository";
import { createOrchestrationRuntimeService } from "@/lib/gea/orchestration-runtime";
import { createGeaRuntimeRegistryAuthority } from "@/lib/gea/runtime-registry-authority";
import type { GeaOrchestrationRoutePermissions } from "@/app/glw/(protected)/orchestrations/access";

type OrchestrationWorkspaceMode =
  | "active"
  | "definitions"
  | "executions"
  | "timeline"
  | "approvals"
  | "delegation"
  | "recovery"
  | "replay"
  | "health"
  | "metrics";

const LABEL: Record<OrchestrationWorkspaceMode, string> = {
  active: "Active Workflows",
  definitions: "Workflow Definitions",
  executions: "Executions",
  timeline: "Timeline",
  approvals: "Approvals",
  delegation: "Delegation",
  recovery: "Recovery",
  replay: "Replay",
  health: "Health",
  metrics: "Metrics",
};

export async function GeaOrchestrationWorkspace({ mode, permissions }: { mode: OrchestrationWorkspaceMode; permissions: GeaOrchestrationRoutePermissions }) {
  const repository = createPrismaOrchestrationRepository();

  const geaRepository = createInMemoryGeaRepository();
  const { capabilityRegistry, toolRegistry } = createGeaRuntimeRegistryAuthority();
  const seedAgent = createSeedAgent({
    agentId: "gea-orchestrator-agent",
    workspaceId: "glw-led-display-warehouse",
    organizationId: "genesis",
    name: "Orchestration Runtime Agent",
    identity: { workspaceId: "glw-led-display-warehouse", organizationId: "genesis", actorId: "system", role: "SYSTEM" },
    capabilities: [{ capabilityId: geaId("geacap"), capabilityKey: "workflow", capabilityVersion: "gea-capability/v1", enabled: true }],
    permissions: ["gea:agents:execute", "gea:tools:execute"],
    currentVersion: {
      agentVersionId: geaId("geaver"),
      agentId: "gea-orchestrator-agent",
      versionTag: "v1",
      planVersion: "gea-plan/v1",
      contextVersion: "gea-context/v1",
      toolsetVersion: "gea-tool/v1",
      createdAt: nowIso(),
    },
  });
  await geaRepository.upsertAgent(seedAgent);

  const agentRuntime = createAgentRuntimeService({ repository: geaRepository, capabilityRegistry, toolRegistry });
  const runtime = createOrchestrationRuntimeService({ repository, agentRuntime });

  const workspaceId = "glw-led-display-warehouse";
  const [orchestrations, workflows, executions, approvals, health] = await Promise.all([
    runtime.listOrchestrations(workspaceId),
    runtime.listWorkflows(workspaceId),
    runtime.listExecutions(workspaceId),
    runtime.listApprovals(workspaceId),
    runtime.listHealth(workspaceId),
  ]);

  const timeline = await runtime.listTimeline(workspaceId, executions[0]?.executionId);
  const replays = await runtime.listReplays(executions[0]?.executionId);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Genesis Enterprise Multi-Agent Orchestration</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">GEA Orchestration Workspace</h1>
        <p className="mt-2 text-sm text-zinc-400">Constitutional orchestration for deterministic multi-agent coordination, approval checkpoints, recovery, replay, and observability.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/glw/orchestrations" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Active</Link>
          <Link href="/glw/orchestrations/definitions" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Definitions</Link>
          <Link href="/glw/orchestrations/executions" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Executions</Link>
          <Link href="/glw/orchestrations/timeline" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Timeline</Link>
          <Link href="/glw/orchestrations/approvals" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Approvals</Link>
          <Link href="/glw/orchestrations/delegation" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Delegation</Link>
          <Link href="/glw/orchestrations/recovery" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Recovery</Link>
          <Link href="/glw/orchestrations/replay" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Replay</Link>
          <Link href="/glw/orchestrations/health" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Health</Link>
          <Link href="/glw/orchestrations/metrics" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Metrics</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Orchestrations</p><p className="mt-2 text-2xl text-white">{orchestrations.length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Workflows</p><p className="mt-2 text-2xl text-white">{workflows.length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Executions</p><p className="mt-2 text-2xl text-white">{executions.length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Approvals</p><p className="mt-2 text-2xl text-white">{approvals.length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Health Records</p><p className="mt-2 text-2xl text-white">{health.length}</p></article>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Current View</p>
        <h2 className="mt-2 text-lg font-semibold text-white">{LABEL[mode]}</h2>

        {mode === "active" ? <div className="mt-4 text-sm text-zinc-300">Workflow execution access: {permissions.canExecuteWorkflows ? "enabled" : "restricted"}.</div> : null}

        {mode === "definitions" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Definition management: {permissions.canManageWorkflowDefinitions ? "enabled" : "restricted"}</p>
            {workflows.length === 0 ? <p className="text-zinc-400">No workflow definitions.</p> : workflows.slice(0, 30).map((entry) => (
              <p key={entry.workflowId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.workflowKey} - {entry.steps.length} steps - {entry.lifecycleState}</p>
            ))}
          </div>
        ) : null}

        {mode === "executions" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {executions.length === 0 ? <p className="text-zinc-400">No executions recorded.</p> : executions.slice(0, 30).map((entry) => (
              <p key={entry.executionId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.executionId} - {entry.state}</p>
            ))}
          </div>
        ) : null}

        {mode === "timeline" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Timeline visibility: {permissions.canViewTimeline ? "enabled" : "restricted"}</p>
            {timeline.length === 0 ? <p className="text-zinc-400">No timeline records.</p> : timeline.slice(0, 10).flatMap((entry) => entry.timeline.map((event, idx) => (
              <p key={`${entry.executionId}-${idx}`} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.executionId} - {event.state} - {event.note}</p>
            )))}
          </div>
        ) : null}

        {mode === "approvals" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Approval rights: {permissions.canApproveWorkflowStages ? "enabled" : "restricted"}</p>
            {approvals.length === 0 ? <p className="text-zinc-400">No approval checkpoints.</p> : approvals.slice(0, 30).map((entry) => (
              <p key={entry.approvalCheckpointId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.stepId} - {entry.state}</p>
            ))}
          </div>
        ) : null}

        {mode === "delegation" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {executions.length === 0 ? <p className="text-zinc-400">No delegation events.</p> : executions.flatMap((entry) => entry.delegations).slice(0, 30).map((entry) => (
              <p key={entry.delegationId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.stepId} - {entry.fromAgentId} to {entry.toAgentId}</p>
            ))}
          </div>
        ) : null}

        {mode === "recovery" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {executions.length === 0 ? <p className="text-zinc-400">No recovery records.</p> : executions.filter((entry) => entry.state === "FAILED" || entry.state === "RECOVERING").slice(0, 30).map((entry) => (
              <p key={entry.executionId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.executionId} - {entry.state}</p>
            ))}
          </div>
        ) : null}

        {mode === "replay" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Replay rights: {permissions.canReplayWorkflows ? "enabled" : "restricted"}</p>
            {replays.length === 0 ? <p className="text-zinc-400">No replay records.</p> : replays.slice(0, 30).map((entry) => (
              <p key={entry.replayRecordId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.executionId} - {entry.determinism}</p>
            ))}
          </div>
        ) : null}

        {mode === "health" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Health visibility: {permissions.canViewHealth ? "enabled" : "restricted"}</p>
            {health.length === 0 ? <p className="text-zinc-400">No health snapshots.</p> : health.slice(0, 20).map((entry) => (
              <p key={entry.healthId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.status} - failures {(entry.failureRate * 100).toFixed(1)}% - queue {entry.queueDepth}</p>
            ))}
          </div>
        ) : null}

        {mode === "metrics" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {health.length === 0 ? <p className="text-zinc-400">No metrics yet.</p> : health.slice(0, 10).map((entry) => (
              <p key={`${entry.healthId}-metrics`} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">duration {entry.metrics.workflowDurationMs}ms - retries {entry.metrics.retryCount} - throughput {entry.metrics.throughputPerHour}/hr</p>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
