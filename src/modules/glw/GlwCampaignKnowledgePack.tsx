"use client";

import { useEffect, useState } from "react";
import type { GlwCampaign } from "./campaign-types";
import type { GlwCampaignKnowledgePack } from "./campaign-reference-types";

export function GlwCampaignKnowledgePack({ campaign, organizationId }: { campaign: GlwCampaign; organizationId: string }) {
  const [pack, setPack] = useState<GlwCampaignKnowledgePack | null>(null);
  const [instructions, setInstructions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState("content_reference");
  const [scope, setScope] = useState("campaign");
  const [message, setMessage] = useState<string | null>(null);
  const headers = {
    "x-gcp-roles": "platform_admin",
    "x-gcp-organization-id": organizationId,
    "x-gcp-site-id": campaign.siteId,
  };
  const endpoint = `/api/glw/campaigns/${encodeURIComponent(campaign.campaignId)}/references`;

  async function load() {
    const response = await fetch(endpoint, { headers });
    if (!response.ok) return;
    const payload = await response.json() as { knowledgePack: GlwCampaignKnowledgePack | null };
    setPack(payload.knowledgePack);
    setInstructions(payload.knowledgePack?.instructions ?? "");
  }
  useEffect(() => { void load(); }, [campaign.campaignId]);

  async function saveInstructions() {
    setMessage(null);
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ instructions }),
    });
    if (!response.ok) { setMessage("Unable to save campaign instructions."); return; }
    const payload = await response.json() as { knowledgePack: GlwCampaignKnowledgePack };
    setPack(payload.knowledgePack);
    setMessage("Campaign instructions saved.");
  }

  async function upload() {
    if (!file) return;
    setMessage(null);
    const form = new FormData();
    form.append("file", file);
    form.append("role", role);
    form.append("scope", scope);
    const response = await fetch(endpoint, { method: "POST", headers, body: form });
    if (!response.ok) { const payload = await response.json(); setMessage(payload.error ?? "Upload failed."); return; }
    setFile(null);
    setMessage("Reference added to campaign knowledge pack.");
    await load();
  }

  return (
    <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="font-semibold text-white">Campaign References</h4>
          <p className="mt-1 text-xs text-zinc-500">Ground page content and image generation before creating the reference page.</p>
        </div>
        <span className="text-xs text-zinc-400">{pack?.references.length ?? 0} files</span>
      </div>

      <label className="mt-4 block text-xs text-zinc-300">
        Campaign Instructions
        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          rows={5}
          placeholder="Describe what this campaign should emphasize, claims to avoid, applications to cover, image direction, and other generation guidance."
          className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm text-white"
        />
      </label>
      <button type="button" onClick={saveInstructions} className="mt-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white hover:border-red-500">Save Instructions</button>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-zinc-300">Reference Role
          <select value={role} onChange={(event) => setRole(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white">
            <option value="authoritative_fact">Authoritative factual source</option>
            <option value="content_reference">Content reference</option>
            <option value="product_image">Product image reference</option>
            <option value="image_style">Image style reference</option>
          </select>
        </label>
        <label className="text-xs text-zinc-300">Scope
          <select value={scope} onChange={(event) => setScope(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white">
            <option value="campaign">Entire campaign</option>
            <option value="reference_only">Reference page only</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input type="file" accept=".pdf,.doc,.docx,.txt,.md,image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="text-xs text-zinc-300" />
        <button type="button" disabled={!file} onClick={upload} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Upload Reference</button>
      </div>

      {pack?.references.length ? (
        <div className="mt-4 space-y-2">
          {pack.references.map((reference) => (
            <div key={reference.referenceId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">
              <span className="text-white">{reference.fileName}</span>
              <span className="text-zinc-500">{reference.role.replaceAll("_", " ")} · {reference.scope.replaceAll("_", " ")}</span>
            </div>
          ))}
        </div>
      ) : null}
      {message ? <p className="mt-3 text-xs text-amber-300">{message}</p> : null}

      <div className="mt-5 border-t border-zinc-800 pt-4">
        <button type="button" disabled className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-500">Generate Reference Page — next gate</button>
      </div>
    </div>
  );
}
