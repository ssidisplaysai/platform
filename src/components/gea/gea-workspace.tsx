import React from "react";
import Link from "next/link";
import { createPrismaGeaRepository } from "@/lib/gea/agent-repository";
import { createInMemoryCapabilityRegistry } from "@/lib/gea/capability-registry";
import { createInMemoryToolRegistry } from "@/lib/gea/tool-framework";
import { createAgentRuntimeService } from "@/lib/gea/agent-runtime";
import type { GeaRoutePermissions } from "@/app/glw/(protected)/agents/access";

type GeaWorkspaceMode =
  | "agents"
  | "executions"
  | "plans"
  | "capabilities"
  | "tools"
  | "approvals"
  | "audit"
  | "replay"
  | "health"
  | "memory"
  | "context"
  | "timeline";

const MODE_LABEL: Record<GeaWorkspaceMode, string> = {
  agents: "Agents",
  executions: "Executions",
  plans: "Plans",
  capabilities: "Capabilities",
  tools: "Tools",
  approvals: "Approvals",
  audit: "Audit",
  replay: "Replay",
  health: "Health",
  memory: "Memory",
  context: "Context",
  timeline: "Timeline",
};

export async function GeaWorkspace({
  mode,
  permissions,
}: {
  mode: GeaWorkspaceMode;
  permissions: GeaRoutePermissions;
}) {
  const repository = createPrismaGeaRepository();
  const capabilityRegistry = createInMemoryCapabilityRegistry();
  const toolRegistry = createInMemoryToolRegistry();
  const runtime = createAgentRuntimeService({ repository, capabilityRegistry, toolRegistry });

  const [agents, executions] = await Promise.all([
    runtime.listAgents("glw-led-display-warehouse"),
    runtime.listExecutions("glw-led-display-warehouse"),
  ]);

  const selectedExecutionId = executions[0]?.executionId;
  const [audit, replays, approvals, memory] = selectedExecutionId
    ? await Promise.all([
      runtime.listAudits(selectedExecutionId),
      runtime.listReplays(selectedExecutionId),
      runtime.listApprovals(selectedExecutionId),
      agents[0] ? runtime.listMemoryReferences(agents[0].agentId) : Promise.resolve([]),
    ])
    : [[], [], [], []];

  const timeline = selectedExecutionId ? await runtime.getTimeline(selectedExecutionId) : [];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Genesis Enterprise Agent Framework</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">GEA Workspace</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Constitutional runtime foundation for governed enterprise agents with deterministic plans, audited execution, and replay.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/glw/agents" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Agents</Link>
          <Link href="/glw/agents/executions" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Executions</Link>
          <Link href="/glw/agents/plans" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Plans</Link>
          <Link href="/glw/agents/capabilities" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Capabilities</Link>
          <Link href="/glw/agents/tools" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Tools</Link>
          <Link href="/glw/agents/approvals" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Approvals</Link>
          <Link href="/glw/agents/audit" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Audit</Link>
          <Link href="/glw/agents/replay" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Replay</Link>
          <Link href="/glw/agents/health" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Health</Link>
          <Link href="/glw/agents/memory" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Memory</Link>
          <Link href="/glw/agents/context" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Context</Link>
          <Link href="/glw/agents/timeline" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Timeline</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Agents</p><p className="mt-2 text-2xl text-white">{agents.length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Executions</p><p className="mt-2 text-2xl text-white">{executions.length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Pending Approvals</p><p className="mt-2 text-2xl text-white">{approvals.filter((entry) => entry.state === "PENDING").length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Replay Records</p><p className="mt-2 text-2xl text-white">{replays.length}</p></article>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Current View</p>
        <h2 className="mt-2 text-lg font-semibold text-white">{MODE_LABEL[mode]}</h2>

        {mode === "agents" ? (
          <div className="mt-4 space-y-3 text-sm text-zinc-300">
            <p>Execute permission: {permissions.canExecuteAgents ? "enabled" : "restricted"}</p>
            {agents.length === 0 ? <p className="text-zinc-400">No agents registered.</p> : agents.map((agent) => (
              <article key={agent.agentId} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <p className="font-medium text-white">{agent.name}</p>
                <p className="mt-1 text-xs text-zinc-400">{agent.agentId} • {agent.lifecycleState}</p>
                <p className="mt-1 text-xs text-zinc-500">Capabilities: {agent.capabilities.map((entry) => entry.capabilityKey).join(", ") || "none"}</p>
              </article>
            ))}
          </div>
        ) : null}

        {mode === "executions" ? (
          <div className="mt-4 space-y-3 text-sm text-zinc-300">
            {executions.length === 0 ? <p className="text-zinc-400">No executions available.</p> : executions.map((execution) => (
              <article key={execution.executionId} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <p className="font-medium text-white">{execution.executionId}</p>
                <p className="mt-1 text-xs text-zinc-400">{execution.state} • {execution.objective}</p>
              </article>
            ))}
          </div>
        ) : null}

        {mode === "plans" ? (
          <div className="mt-4 text-sm text-zinc-300">Plan orchestration is deterministic and immutable after execution starts.</div>
        ) : null}

        {mode === "capabilities" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Capability management: {permissions.canManageCapabilities ? "enabled" : "restricted"}</p>
            {capabilityRegistry.list().slice(0, 8).map((capability) => (
              <p key={capability.capabilityKey} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{capability.capabilityKey} ({capability.capabilityVersion})</p>
            ))}
          </div>
        ) : null}

        {mode === "tools" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Tool governance: {permissions.canManageTools ? "enabled" : "restricted"}</p>
            {toolRegistry.list().map((tool) => (
              <p key={tool.toolKey} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{tool.toolKey} ({tool.capabilityKey})</p>
            ))}
          </div>
        ) : null}

        {mode === "approvals" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Approval controls: {permissions.canApprovePlans ? "enabled" : "restricted"}</p>
            {approvals.length === 0 ? <p className="text-zinc-400">No approvals recorded.</p> : approvals.map((entry) => (
              <p key={entry.approvalId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.taskId} • {entry.state}</p>
            ))}
          </div>
        ) : null}

        {mode === "audit" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Audit visibility: {permissions.canViewAudit ? "enabled" : "restricted"}</p>
            {audit.length === 0 ? <p className="text-zinc-400">No audit records.</p> : audit.map((entry) => (
              <p key={entry.auditRecordId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.eventType} • {entry.actorId}</p>
            ))}
          </div>
        ) : null}

        {mode === "replay" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Replay access: {permissions.canReplayExecutions ? "enabled" : "restricted"}</p>
            {replays.length === 0 ? <p className="text-zinc-400">No replay records.</p> : replays.map((entry) => (
              <p key={entry.replayId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.replayId} • deterministic={String(entry.deterministicMatch)}</p>
            ))}
          </div>
        ) : null}

        {mode === "health" ? (
          <div className="mt-4 text-sm text-zinc-300">Health visibility: {permissions.canViewHealth ? "enabled" : "restricted"}</div>
        ) : null}

        {mode === "memory" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Memory visibility: {permissions.canViewMemory ? "enabled" : "restricted"}</p>
            {memory.length === 0 ? <p className="text-zinc-400">No memory references captured.</p> : memory.map((entry) => (
              <p key={entry.memoryReferenceId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.referenceType} • {entry.referenceId}@{entry.referenceVersion}</p>
            ))}
          </div>
        ) : null}

        {mode === "context" ? (
          <div className="mt-4 text-sm text-zinc-300">Context controls: {permissions.canManageContext ? "enabled" : "restricted"}. Context snapshots are reproducible and authorization-scoped.</div>
        ) : null}

        {mode === "timeline" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {timeline.length === 0 ? <p className="text-zinc-400">No timeline events available.</p> : timeline.map((entry, index) => (
              <p key={`${entry.at}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.at} • {entry.state} • {entry.note}</p>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
