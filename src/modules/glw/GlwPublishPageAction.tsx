"use client";

import React, { useState } from "react";
import { operatorMutationHeaders } from "@/modules/foundation/operator-session-client";

export function GlwPublishPageAction(props: {
  endpoint: string;
  organizationId: string;
  siteId: string;
  targetId: string;
}) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const publish = async () => {
    if (!window.confirm("Publish this exact draft-ready page now?")) return;

    setRunning(true);
    setError(null);
    setDone(false);

    try {
      const response = await fetch(props.endpoint, {
        method: "POST",
        headers: operatorMutationHeaders({
          "content-type": "application/json",
          "x-gcp-roles": "platform_admin",
          "x-gcp-organization-id": props.organizationId,
          "x-gcp-site-id": props.siteId,
        }),
        body: JSON.stringify({
          confirm: "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS",
          targetId: props.targetId,
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string; publicationPerformed?: boolean } | null;
      if (!response.ok) throw new Error(body?.error ?? "Publish page failed");
      if (body?.publicationPerformed !== true) throw new Error("Publish action completed without publication.");

      setDone(true);
      window.setTimeout(() => {
        window.location.reload();
      }, 250);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Publish page failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3" aria-label="Publish page action">
      <button
        type="button"
        disabled={running}
        onClick={publish}
        className="bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        {running ? "Publishing..." : "Publish Page"}
      </button>
      {done ? <span className="text-xs font-semibold text-emerald-300">Published</span> : null}
      {error ? <p role="alert" className="w-full text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
