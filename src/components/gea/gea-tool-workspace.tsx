import React from "react";
import Link from "next/link";
import { createPrismaToolFrameworkRepository } from "@/lib/gea/tool-repository";
import { createToolRegistryService } from "@/lib/gea/tool-registry-service";
import { createExecutionCoordinator } from "@/lib/gea/tool-execution-engine";
import { createToolAuthorizationEngine } from "@/lib/gea/tool-authorization";
import type { GeaToolRoutePermissions } from "@/app/glw/(protected)/tools/access";

type ToolWorkspaceMode =
  | "catalog"
  | "executions"
  | "health"
  | "categories"
  | "versions"
  | "replay"
  | "audit"
  | "validation"
  | "policies";

const LABEL: Record<ToolWorkspaceMode, string> = {
  catalog: "Tool Catalog",
  executions: "Executions",
  health: "Health",
  categories: "Categories",
  versions: "Versions",
  replay: "Replay",
  audit: "Audit",
  validation: "Validation",
  policies: "Policies",
};

export async function GeaToolWorkspace({ mode, permissions }: { mode: ToolWorkspaceMode; permissions: GeaToolRoutePermissions }) {
  const repository = createPrismaToolFrameworkRepository();
  const registry = createToolRegistryService(repository);
  const execution = createExecutionCoordinator({
    repository,
    registry,
    authorizationEngine: createToolAuthorizationEngine(),
  });

  const [catalog, executions, health, replayRecords, validations, policyHistory] = await Promise.all([
    registry.discoverTools("glw-led-display-warehouse"),
    execution.listExecutions("glw-led-display-warehouse"),
    execution.listHealth(),
    execution.listReplays(),
    repository.listValidationRecords(),
    repository.listPolicyHistory(),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Genesis Enterprise Tool Framework</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">GEA Tool Workspace</h1>
        <p className="mt-2 text-sm text-zinc-400">Constitutional tool runtime for governed registration, execution, authorization, audit, replay, and lifecycle management.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/glw/tools" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Catalog</Link>
          <Link href="/glw/tools/executions" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Executions</Link>
          <Link href="/glw/tools/health" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Health</Link>
          <Link href="/glw/tools/categories" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Categories</Link>
          <Link href="/glw/tools/versions" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Versions</Link>
          <Link href="/glw/tools/replay" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Replay</Link>
          <Link href="/glw/tools/audit" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Audit</Link>
          <Link href="/glw/tools/validation" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Validation</Link>
          <Link href="/glw/tools/policies" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Policies</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Tools</p><p className="mt-2 text-2xl text-white">{catalog.length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Executions</p><p className="mt-2 text-2xl text-white">{executions.length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Replay Records</p><p className="mt-2 text-2xl text-white">{replayRecords.length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Health Snapshots</p><p className="mt-2 text-2xl text-white">{health.length}</p></article>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Current View</p>
        <h2 className="mt-2 text-lg font-semibold text-white">{LABEL[mode]}</h2>

        {mode === "catalog" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Registry management: {permissions.canManageRegistry ? "enabled" : "restricted"}</p>
            {catalog.length === 0 ? <p className="text-zinc-400">No tools registered.</p> : catalog.map((entry) => (
              <p key={entry.toolId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.identifier} ({entry.version}) - {entry.category}</p>
            ))}
          </div>
        ) : null}

        {mode === "executions" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Execution rights: {permissions.canExecuteTools ? "enabled" : "restricted"}</p>
            {executions.length === 0 ? <p className="text-zinc-400">No tool executions recorded.</p> : executions.map((entry) => (
              <p key={entry.executionId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.executionId} - {entry.state} - {entry.toolId}</p>
            ))}
          </div>
        ) : null}

        {mode === "health" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Health visibility: {permissions.canViewHealth ? "enabled" : "restricted"}</p>
            {health.length === 0 ? <p className="text-zinc-400">No health snapshots available.</p> : health.map((entry) => (
              <p key={entry.healthId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.toolId} - {entry.healthStatus} - success {Math.round(entry.successRate * 100)}%</p>
            ))}
          </div>
        ) : null}

        {mode === "categories" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {registry.listCategories().map((entry) => (
              <p key={entry} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry}</p>
            ))}
          </div>
        ) : null}

        {mode === "versions" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Version management: {permissions.canManageVersions ? "enabled" : "restricted"}</p>
            {catalog.length === 0 ? <p className="text-zinc-400">No version history available.</p> : catalog.map((entry) => (
              <p key={`${entry.toolId}-${entry.version}`} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.identifier} - active {entry.version}</p>
            ))}
          </div>
        ) : null}

        {mode === "replay" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Replay access: {permissions.canReplayExecutions ? "enabled" : "restricted"}</p>
            {replayRecords.length === 0 ? <p className="text-zinc-400">No replay records available.</p> : replayRecords.map((entry) => (
              <p key={entry.replayId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.executionId} - deterministic supported={String(entry.deterministicSupported)}</p>
            ))}
          </div>
        ) : null}

        {mode === "audit" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Audit visibility: {permissions.canViewAudit ? "enabled" : "restricted"}</p>
            {executions.length === 0 ? <p className="text-zinc-400">No execution audit trail available.</p> : executions.slice(0, 25).map((entry) => (
              <p key={entry.executionId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.executionId} - lineage {entry.immutableLineage.slice(0, 16)}...</p>
            ))}
          </div>
        ) : null}

        {mode === "validation" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Validation rights: {permissions.canValidateTools ? "enabled" : "restricted"}</p>
            {validations.length === 0 ? <p className="text-zinc-400">No validation records available.</p> : validations.map((entry) => (
              <p key={entry.validationId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.toolVersionId} - {entry.validationStatus}</p>
            ))}
          </div>
        ) : null}

        {mode === "policies" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {policyHistory.length === 0 ? <p className="text-zinc-400">No policy history records available.</p> : policyHistory.map((entry) => (
              <p key={entry.policyRecordId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.toolVersionId} - {entry.nextPolicyChecksum.slice(0, 16)}...</p>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
