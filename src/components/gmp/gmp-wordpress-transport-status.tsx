import React from "react";

type TransportStatus = {
  destinationType?: string;
  health?: Record<string, unknown>;
  capabilityProfile?: Record<string, boolean>;
  destination?: {
    metadata?: Record<string, unknown>;
    configuration?: Record<string, unknown>;
  };
};

function seoIntegration(configuration: Record<string, unknown> | undefined): string {
  const integration = String(configuration?.seoIntegration ?? "native").toLowerCase();
  if (["native", "yoast", "rank_math", "custom_fields"].includes(integration)) {
    return integration;
  }
  return "native";
}

export function GmpWordpressTransportStatus({ detail }: { detail: TransportStatus | null | undefined }) {
  if (!detail) return <p className="text-sm text-zinc-400">WordPress transport status unavailable.</p>;

  const configuration = detail.destination?.configuration ?? {};
  const detectedSeoIntegration = seoIntegration(configuration);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-lg font-semibold text-white">WordPress Transport Status</h2>
      <p className="mt-1 text-sm text-zinc-400">REST availability: {String((detail.health?.connectionHealth as { status?: string } | undefined)?.status ?? "unknown")}</p>
      <p className="text-sm text-zinc-400">Authenticated site identity: {String(detail.destination?.metadata?.safeSiteIdentity ?? "not reported")}</p>
      <p className="text-sm text-zinc-400">Supported post types: {String(configuration.postTypes ?? "pages")}</p>
      <p className="text-sm text-zinc-400">Media endpoint availability: {detail.capabilityProfile?.uploadMedia ? "supported" : "unsupported"}</p>
      <p className="text-sm text-zinc-400">Scheduling support: {detail.capabilityProfile?.schedulePublication ? "supported" : "unsupported"}</p>
      <p className="text-sm text-zinc-400">Detected SEO integration: {detectedSeoIntegration}</p>
      <p className="text-sm text-zinc-400">Remote timezone: {String(detail.destination?.metadata?.remoteTimezone ?? "unknown")}</p>
      <p className="text-sm text-zinc-400">Last transport success: {String(detail.health?.lastTransportSuccessAt ?? "none")}</p>
      <p className="text-sm text-zinc-400">Last transport failure: {String(detail.health?.lastTransportFailureAt ?? "none")}</p>
      <p className="text-sm text-zinc-400">Adapter version: gmp-wordpress-adapter/v1</p>

      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">SEO Capability Mapping</p>
        <p className="text-xs text-zinc-300">Native WordPress metadata: supported</p>
        <p className="text-xs text-zinc-300">Yoast SEO: {detectedSeoIntegration === "yoast" ? "detected" : "not detected"}</p>
        <p className="text-xs text-zinc-300">Rank Math: {detectedSeoIntegration === "rank_math" ? "detected" : "not detected"}</p>
        <p className="text-xs text-zinc-300">Generic custom fields: {detectedSeoIntegration === "custom_fields" ? "detected" : "supported via configured mappings"}</p>
      </div>
    </section>
  );
}
