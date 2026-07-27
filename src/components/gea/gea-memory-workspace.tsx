import React from "react";
import Link from "next/link";
import { createContextBuilderService } from "@/lib/gea/context-framework";
import { createMemoryCatalog, createMemoryRegistryService, createMemoryResolver } from "@/lib/gea/memory-registry";
import { createPrismaMemoryRepository } from "@/lib/gea/memory-repository";
import type { GeaMemoryRoutePermissions } from "@/app/glw/(protected)/memory/access";

type MemoryWorkspaceMode =
  | "registry"
  | "packages"
  | "provenance"
  | "replay"
  | "validation"
  | "cache"
  | "health"
  | "versions"
  | "policies";

const LABEL: Record<MemoryWorkspaceMode, string> = {
  registry: "Memory Registry",
  packages: "Context Packages",
  provenance: "Provenance",
  replay: "Replay",
  validation: "Validation",
  cache: "Cache",
  health: "Health",
  versions: "Versions",
  policies: "Policies",
};

export async function GeaMemoryWorkspace({ mode, permissions }: { mode: MemoryWorkspaceMode; permissions: GeaMemoryRoutePermissions }) {
  const repository = createPrismaMemoryRepository();
  const registry = createMemoryRegistryService(repository);
  const resolver = createMemoryResolver();
  const catalog = createMemoryCatalog(repository);
  const context = createContextBuilderService({ repository, registry, resolver });

  const workspaceId = "glw-led-display-warehouse";

  const [references, packages, cache, health, validations, replays] = await Promise.all([
    catalog.search(workspaceId),
    context.listContextPackages(workspaceId),
    context.listCache(workspaceId),
    context.listHealth(workspaceId),
    context.listValidations(),
    context.listReplays(),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-500">Genesis Enterprise Memory &amp; Context Framework</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">GEA Memory Workspace</h1>
        <p className="mt-2 text-sm text-zinc-400">Constitutional memory and context assembly runtime with deterministic provenance, replay, cache control, and validation.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/glw/memory" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Registry</Link>
          <Link href="/glw/memory/packages" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Packages</Link>
          <Link href="/glw/memory/provenance" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Provenance</Link>
          <Link href="/glw/memory/replay" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Replay</Link>
          <Link href="/glw/memory/validation" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Validation</Link>
          <Link href="/glw/memory/cache" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Cache</Link>
          <Link href="/glw/memory/health" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Health</Link>
          <Link href="/glw/memory/versions" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Versions</Link>
          <Link href="/glw/memory/policies" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100">Policies</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">References</p><p className="mt-2 text-2xl text-white">{references.length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Context Packages</p><p className="mt-2 text-2xl text-white">{packages.length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Cache Entries</p><p className="mt-2 text-2xl text-white">{cache.length}</p></article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">Health Snapshots</p><p className="mt-2 text-2xl text-white">{health.length}</p></article>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Current View</p>
        <h2 className="mt-2 text-lg font-semibold text-white">{LABEL[mode]}</h2>

        {mode === "registry" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Registry management: {permissions.canManageRegistry ? "enabled" : "restricted"}</p>
            {references.length === 0 ? <p className="text-zinc-400">No memory references registered.</p> : references.slice(0, 40).map((entry) => (
              <p key={entry.memoryReferenceId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.referenceType} - {entry.referenceId}@{entry.referenceVersion}</p>
            ))}
          </div>
        ) : null}

        {mode === "packages" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Context build access: {permissions.canBuildContext ? "enabled" : "restricted"}</p>
            {packages.length === 0 ? <p className="text-zinc-400">No context packages available.</p> : packages.slice(0, 40).map((entry) => (
              <p key={entry.contextPackageId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.contextPackageId} - {entry.lifecycleState} - {entry.sections.length} sections</p>
            ))}
          </div>
        ) : null}

        {mode === "provenance" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Provenance access: {permissions.canViewProvenance ? "enabled" : "restricted"}</p>
            {packages.length === 0 ? <p className="text-zinc-400">No provenance records available.</p> : packages.slice(0, 10).flatMap((entry) => entry.sections.map((section) => (
              <p key={`${entry.contextPackageId}-${section.sectionId}`} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.contextPackageId} - {section.sourceType} - refs {section.references.length}</p>
            )))}
          </div>
        ) : null}

        {mode === "replay" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Replay access: {permissions.canReplayContext ? "enabled" : "restricted"}</p>
            {replays.length === 0 ? <p className="text-zinc-400">No context replay records available.</p> : replays.slice(0, 40).map((entry) => (
              <p key={entry.contextReplayId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.contextPackageId} - deterministic match {String(entry.deterministicMatch)}</p>
            ))}
          </div>
        ) : null}

        {mode === "validation" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Validation rights: {permissions.canValidateContext ? "enabled" : "restricted"}</p>
            {validations.length === 0 ? <p className="text-zinc-400">No validation records available.</p> : validations.slice(0, 40).map((entry) => (
              <p key={entry.contextValidationId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.contextPackageId} - {entry.validationStatus}</p>
            ))}
          </div>
        ) : null}

        {mode === "cache" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Cache visibility: {permissions.canViewCache ? "enabled" : "restricted"}</p>
            {cache.length === 0 ? <p className="text-zinc-400">No cache records available.</p> : cache.slice(0, 40).map((entry) => (
              <p key={entry.contextCacheId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.contextPackageId} - {entry.cacheStatus} - hits {entry.hitCount}</p>
            ))}
          </div>
        ) : null}

        {mode === "health" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>Health visibility: {permissions.canViewHealth ? "enabled" : "restricted"}</p>
            {health.length === 0 ? <p className="text-zinc-400">No health snapshots available.</p> : health.slice(0, 40).map((entry) => (
              <p key={entry.contextHealthId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.healthStatus} - latency {entry.assemblyLatencyMs}ms - cache {(entry.cacheUtilization * 100).toFixed(0)}%</p>
            ))}
          </div>
        ) : null}

        {mode === "versions" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {packages.length === 0 ? <p className="text-zinc-400">No context versions available.</p> : packages.slice(0, 40).map((entry) => (
              <p key={entry.contextPackageId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.contextPackageId} - {entry.contextVersion} - assembly {entry.assembly.assemblyVersion}</p>
            ))}
          </div>
        ) : null}

        {mode === "policies" ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            {packages.length === 0 ? <p className="text-zinc-400">No policy records available.</p> : packages.slice(0, 40).map((entry) => (
              <p key={entry.contextPackageId} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">{entry.contextPackageId} - {entry.policy.policyVersion} - deny {String(entry.policy.defaultDeny)}</p>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
