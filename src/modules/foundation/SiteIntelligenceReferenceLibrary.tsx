"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import type { CreativeInput, SiteAssetClassification, SiteIntelligenceWorkspace } from "./site-intelligence";

const classifications: Array<{ value: SiteAssetClassification; label: string }> = [
  { value: "OWNER_SUPPLIED_REFERENCE", label: "Owner supplied reference" },
  { value: "EXTERNAL_INSPIRATION_ONLY", label: "External inspiration" },
  { value: "COMPETITOR_REFERENCE_ONLY", label: "Competitor reference only" },
  { value: "OWNER_APPROVED_PUBLISHABLE", label: "Owner approved publishable" },
  { value: "UNVERIFIED", label: "Unverified" },
  { value: "REJECTED", label: "Rejected / archived" },
];
const preferences = [
  { value: "LIKE", label: "Like" },
  { value: "DISLIKE", label: "Dislike" },
  { value: "REFERENCE_ONLY", label: "Reference only" },
] as const;
const fieldClass = "mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3 text-white";

type Props = {
  organizationId: string;
  siteId: string;
  workspace: SiteIntelligenceWorkspace | null;
  busy: boolean;
  onAction(body: Record<string, unknown>): Promise<SiteIntelligenceWorkspace | null>;
  onWorkspace(workspace: SiteIntelligenceWorkspace): void;
};

export function SiteIntelligenceReferenceLibrary(props: Props) {
  const inputs = props.workspace?.creativeInputs ?? [];
  const urls = inputs.filter((input) => input.kind === "URL");
  const assets = inputs.filter((input) => input.binaryAsset);
  const likes = inputs.filter((input) => input.sentiment === "LIKE").length;
  const dislikes = inputs.filter((input) => input.sentiment === "DISLIKE").length;
  const references = inputs.length - likes - dislikes;

  return <section className="space-y-4 border border-zinc-800 bg-zinc-950 p-5">
    <header>
      <h2 className="font-semibold text-white">Reference Library</h2>
      <p className="mt-1 text-sm text-zinc-400">Collect independent web and file references. References are not publishable unless the owner explicitly approves that classification.</p>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
        <Counter label="References" value={inputs.length} />
        <Counter label="Web" value={urls.length} />
        <Counter label="Assets" value={assets.length} />
        <Counter label="Likes" value={likes} />
        <Counter label="Dislikes" value={dislikes} />
        <Counter label="Reference only" value={references} />
      </dl>
    </header>
    <UrlReferenceForm busy={props.busy} onAction={props.onAction} />
    <UploadForm {...props} />
    <div>
      <h3 className="text-sm font-semibold text-white">Web References ({urls.length})</h3>
      {urls.length ? <div className="mt-3 grid gap-3 lg:grid-cols-2">{urls.map((input) => <ReferenceCard key={input.inputId} input={input} busy={props.busy} onAction={props.onAction} />)}</div> : <p className="mt-2 text-sm text-zinc-500">No web references saved.</p>}
    </div>
    <div>
      <h3 className="text-sm font-semibold text-white">Uploaded Assets ({assets.length})</h3>
      {assets.length ? <div className="mt-3 grid gap-3 lg:grid-cols-2">{assets.map((input) => <ReferenceCard key={input.inputId} input={input} busy={props.busy} onAction={props.onAction} organizationId={props.organizationId} siteId={props.siteId} />)}</div> : <p className="mt-2 text-sm text-zinc-500">No uploaded assets saved.</p>}
    </div>
  </section>;
}

function Counter({ label, value }: { label: string; value: number }) {
  return <div className="border border-zinc-800 p-3"><dt className="text-zinc-500">{label}</dt><dd className="mt-1 text-base font-semibold text-zinc-100">{value}</dd></div>;
}

function UrlReferenceForm({ busy, onAction }: Pick<Props, "busy" | "onAction">) {
  const [reference, setReference] = useState("");
  const [classification, setClassification] = useState<SiteAssetClassification>("OWNER_SUPPLIED_REFERENCE");
  const [sentiment, setSentiment] = useState<CreativeInput["sentiment"]>("REFERENCE_ONLY");
  const [notes, setNotes] = useState("");
  async function add() {
    const result = await onAction({ action: "ADD_URL_REFERENCE", reference, classification, sentiment, notes, reason: "Owner added a web reference." });
    if (result) { setReference(""); setNotes(""); setClassification("OWNER_SUPPLIED_REFERENCE"); setSentiment("REFERENCE_ONLY"); }
  }
  return <div className="border-t border-zinc-800 pt-4">
    <h3 className="text-sm font-semibold text-white">Add Web Reference</h3>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <Field label="URL"><input type="url" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="https://example.com/page" className={fieldClass} /></Field>
      <Field label="Classification"><ClassificationSelect value={classification} onChange={setClassification} /></Field>
      <Field label="Preference"><PreferenceSelect value={sentiment} onChange={setSentiment} /></Field>
      <Field label="Purpose / notes"><input value={notes} onChange={(event) => setNotes(event.target.value)} className={fieldClass} /></Field>
    </div>
    <button type="button" disabled={busy || !reference.trim()} onClick={add} className="mt-3 border border-zinc-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">ADD REFERENCE</button>
  </div>;
}

function UploadForm(props: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [classification, setClassification] = useState<SiteAssetClassification>("OWNER_SUPPLIED_REFERENCE");
  const [sentiment, setSentiment] = useState<CreativeInput["sentiment"]>("REFERENCE_ONLY");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  async function upload() {
    setUploading(true); setMessage(null);
    try {
      const form = new FormData(); files.forEach((file) => form.append("files", file)); form.set("classification", classification); form.set("sentiment", sentiment); form.set("notes", notes); form.set("expectedRevision", String(props.workspace?.revision ?? 0));
      const response = await fetch(`/api/sites/${encodeURIComponent(props.siteId)}/intelligence/assets`, { method: "POST", headers: { "x-gcp-roles": "ops_manager", "x-gcp-organization-id": props.organizationId, "x-gcp-site-id": props.siteId }, body: form });
      const payload = await response.json() as { workspace?: SiteIntelligenceWorkspace; assets?: unknown[]; error?: string };
      if (!response.ok || !payload.workspace) throw new Error(payload.error ?? "Upload failed.");
      props.onWorkspace(payload.workspace); setFiles([]); setNotes(""); setInputKey((value) => value + 1); setMessage(`${payload.assets?.length ?? 0} file(s) added.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); }
    finally { setUploading(false); }
  }
  return <div className="border-t border-zinc-800 pt-4">
    <h3 className="text-sm font-semibold text-white">Upload Files</h3><p className="mt-1 text-xs text-zinc-500">Select 1-10 images or PDFs. Maximum 25 MB each and 50 MB per batch.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <Field label="Choose files" wide><input key={inputKey} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} className="mt-1 block w-full border border-dashed border-zinc-700 p-4 text-zinc-300" /></Field>
      <Field label="Classification"><ClassificationSelect value={classification} onChange={setClassification} /></Field>
      <Field label="Preference"><PreferenceSelect value={sentiment} onChange={setSentiment} /></Field>
      <Field label="Batch notes" wide><input value={notes} onChange={(event) => setNotes(event.target.value)} className={fieldClass} /></Field>
    </div>
    <button type="button" disabled={props.busy || uploading || files.length === 0 || files.length > 10} onClick={upload} className="mt-3 bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">UPLOAD {files.length || ""} FILES</button>
    {message ? <p className="mt-2 text-xs text-zinc-300">{message}</p> : null}
  </div>;
}

function ReferenceCard({ input, busy, onAction, organizationId, siteId }: { input: CreativeInput; busy: boolean; onAction: Props["onAction"]; organizationId?: string; siteId?: string }) {
  const [editing, setEditing] = useState(false);
  const [reference, setReference] = useState(input.reference);
  const [classification, setClassification] = useState(input.classification);
  const [sentiment, setSentiment] = useState<CreativeInput["sentiment"]>(input.sentiment === "NEUTRAL" ? "REFERENCE_ONLY" : input.sentiment);
  const [notes, setNotes] = useState(input.notes ?? "");
  const asset = input.binaryAsset;
  const publishability = input.classification === "OWNER_APPROVED_PUBLISHABLE" ? "Explicitly approved for later publishable use" : "Reference only - not publishable";
  async function save(nextClassification = classification) {
    const result = await onAction({ action: "UPDATE_CREATIVE_INPUT", inputId: input.inputId, reference: input.kind === "URL" ? reference : undefined, classification: nextClassification, sentiment, notes, reason: nextClassification === "REJECTED" ? "Owner rejected and archived reference." : "Owner updated reference metadata." });
    if (result) { setClassification(nextClassification); setEditing(false); }
  }
  return <article className="border border-zinc-800 p-4">
    {asset?.mediaType.startsWith("image/") && organizationId && siteId ? <AssetPreview assetId={asset.assetId} fileName={asset.originalFileName} organizationId={organizationId} siteId={siteId} /> : asset ? <div className="flex aspect-video items-center justify-center bg-zinc-900 text-xs text-zinc-400">PDF document</div> : null}
    <p className="mt-2 break-all text-sm font-medium text-zinc-100">{asset?.originalFileName ?? input.reference}</p>
    {input.kind === "URL" ? <p className="mt-1 text-xs text-zinc-500">{new URL(input.reference).hostname}</p> : null}
    {asset ? <p className="mt-1 break-all text-xs text-zinc-500">{asset.mediaType} · {asset.sizeBytes} bytes · SHA-256 {asset.sha256}</p> : null}
    <p className="mt-2 text-xs text-zinc-400">{input.classification} · {input.sentiment === "NEUTRAL" ? "REFERENCE_ONLY" : input.sentiment}</p>
    <p className="mt-1 text-xs text-zinc-500">{input.notes || "No notes"}</p>
    <p className="mt-1 text-xs text-zinc-500">Added {input.suppliedAt} by {input.suppliedBy} · Provenance: {asset ? "OWNER_UPLOAD" : "OWNER_URL"}</p>
    <p className={`mt-1 text-xs ${input.classification === "OWNER_APPROVED_PUBLISHABLE" ? "text-emerald-300" : "text-amber-300"}`}>{publishability}</p>
    {editing ? <div className="mt-3 grid gap-2">
      {input.kind === "URL" ? <Field label="URL"><input type="url" value={reference} onChange={(event) => setReference(event.target.value)} className={fieldClass} /></Field> : null}
      <Field label="Classification"><ClassificationSelect value={classification} onChange={setClassification} /></Field>
      <Field label="Preference"><PreferenceSelect value={sentiment} onChange={setSentiment} /></Field>
      <Field label="Notes"><input value={notes} onChange={(event) => setNotes(event.target.value)} className={fieldClass} /></Field>
      <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => save()} className="border border-zinc-700 px-3 py-2 text-xs text-white">SAVE</button><button type="button" onClick={() => setEditing(false)} className="px-3 py-2 text-xs text-zinc-400">CANCEL</button></div>
    </div> : <div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => setEditing(true)} className="border border-zinc-700 px-3 py-2 text-xs text-white">EDIT</button><button type="button" disabled={busy || input.classification === "REJECTED"} onClick={() => save("REJECTED")} className="border border-red-900 px-3 py-2 text-xs text-red-300 disabled:opacity-40">REJECT / ARCHIVE</button></div>}
  </article>;
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) { return <label className={`text-xs text-zinc-400 ${wide ? "sm:col-span-2" : ""}`}>{label}{children}</label>; }
function ClassificationSelect({ value, onChange }: { value: SiteAssetClassification; onChange(value: SiteAssetClassification): void }) { return <select value={value} onChange={(event) => onChange(event.target.value as SiteAssetClassification)} className={fieldClass}>{classifications.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>; }
function PreferenceSelect({ value, onChange }: { value: CreativeInput["sentiment"]; onChange(value: CreativeInput["sentiment"]): void }) { return <select value={value} onChange={(event) => onChange(event.target.value as CreativeInput["sentiment"])} className={fieldClass}>{preferences.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>; }

function AssetPreview({ assetId, fileName, organizationId, siteId }: { assetId: string; fileName: string; organizationId: string; siteId: string }) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let active = true; let objectUrl: string | null = null;
    fetch(`/api/sites/${encodeURIComponent(siteId)}/intelligence/assets/${encodeURIComponent(assetId)}`, { headers: { "x-gcp-roles": "ops_manager", "x-gcp-organization-id": organizationId, "x-gcp-site-id": siteId }, cache: "no-store" }).then((response) => { if (!response.ok) throw new Error("Preview unavailable"); return response.blob(); }).then((blob) => { if (active) { objectUrl = URL.createObjectURL(blob); setSource(objectUrl); } }).catch(() => undefined);
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [assetId, organizationId, siteId]);
  return source ? <Image src={source} alt={fileName} width={640} height={360} unoptimized className="aspect-video w-full object-cover" /> : <div className="flex aspect-video items-center justify-center bg-zinc-900 text-xs text-zinc-500">Loading preview...</div>;
}
