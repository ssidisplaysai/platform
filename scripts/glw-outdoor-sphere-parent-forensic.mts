import { createDecipheriv, createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

const root = process.env.GCP_FOUNDATION_PERSISTENCE_DIR?.trim();
if (!root) throw new Error("GCP_FOUNDATION_PERSISTENCE_DIR_REQUIRED");

type RecordValue = Record<string, unknown>;
function object(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
}
function text(value: unknown): string {
  if (typeof value === "string") return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const record = object(value);
  return record ? text(record.raw) || text(record.rendered) : "";
}
function findSite(value: unknown): RecordValue | null {
  if (Array.isArray(value)) {
    for (const item of value) { const found = findSite(item); if (found) return found; }
    return null;
  }
  const record = object(value);
  if (!record) return null;
  if (record.siteId === "site-led-display-warehouse-production" && object(record.integrations)?.wordpressApiBaseUrl) return record;
  for (const item of Object.values(record)) { const found = findSite(item); if (found) return found; }
  return null;
}

let site: RecordValue | null = null;
for (const name of readdirSync(root).filter((value) => value.endsWith(".json"))) {
  try { site = findSite(JSON.parse(readFileSync(join(root, name), "utf8"))); } catch { site = null; }
  if (site) break;
}
if (!site) throw new Error("SITE_NOT_FOUND");
const integrations = object(site.integrations)!;
const credentialReference = String(integrations.wordpressCredentialReference ?? "");
const credentialEnvelope = JSON.parse(readFileSync(join(root, "wordpress-credential-store.json"), "utf8"));
const credentials = object(credentialEnvelope.data)?.credentials;
const records = Array.isArray(credentials) ? credentials.map(object).filter(Boolean) as RecordValue[] : [];
const encrypted = records.find((record) => record.reference === credentialReference);
if (!encrypted) throw new Error("WORDPRESS_CREDENTIAL_NOT_FOUND");
const key = Buffer.from(process.env.GENESIS_CREDENTIAL_MASTER_KEY?.trim() ?? "", "base64");
if (key.length !== 32) throw new Error("GENESIS_CREDENTIAL_MASTER_KEY_INVALID");
const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(String(encrypted.iv), "base64"));
decipher.setAuthTag(Buffer.from(String(encrypted.authTag), "base64"));
const credential = JSON.parse(Buffer.concat([decipher.update(Buffer.from(String(encrypted.ciphertext), "base64")), decipher.final()]).toString("utf8")) as { username: string; applicationPassword: string };
const apiBase = String(integrations.wordpressApiBaseUrl).replace(/\/$/, "");
const authorization = `Basic ${Buffer.from(`${credential.username}:${credential.applicationPassword}`).toString("base64")}`;

async function get(path: string, query = new URLSearchParams()): Promise<{ status: number; body: unknown }> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${apiBase}${path}?${query}`, { headers: { Accept: "application/json", Authorization: authorization, "Cache-Control": "no-cache" }, cache: "no-store", signal: AbortSignal.timeout(30_000) });
      return { status: response.status, body: await response.json().catch(() => null) };
    } catch {
      if (attempt === 3) return { status: 0, body: null };
    }
  }
  return { status: 0, body: null };
}

const typesResult = await get("/types", new URLSearchParams({ context: "edit" }));
if (typesResult.status !== 200) throw new Error(`WORDPRESS_TYPES_READ_FAILED:${typesResult.status}`);
const types = object(typesResult.body) ?? {};
const searchableTypes = Object.values(types).map(object).filter(Boolean).map((type) => ({
  name: String(type!.name ?? ""),
  restBase: String(type!.rest_base ?? ""),
  slug: String(type!.slug ?? ""),
})).filter((type) => type.restBase && !["attachment", "wp_block", "wp_template", "wp_template_part", "wp_navigation"].includes(type.slug));
const terms = ["Outdoor Digital Sphere", "Outdoor LED Sphere", "Digital Sphere", "LED Sphere", "Sphere", "outdoor-digital-sphere", "outdoor-led-sphere"];
const statuses = ["publish", "draft", "private", "pending", "future", "trash"];
const candidates = new Map<string, RecordValue>();
const failedInventoryReads: Array<{ restBase: string; term: string; status: string }> = [];

for (const type of searchableTypes) {
  for (const term of terms) {
    for (const status of statuses) {
      const result = await get(`/${type.restBase}`, new URLSearchParams({ search: term, status, context: "edit", per_page: "100", _fields: "id,type,slug,status,parent,link,title,content,featured_media,meta,yoast_head_json" }));
      if (result.status !== 200 || !Array.isArray(result.body)) {
        if (result.status === 0) failedInventoryReads.push({ restBase: type.restBase, term, status });
        continue;
      }
      for (const item of result.body) {
        const record = object(item);
        if (!record?.id) continue;
        const keyValue = `${type.restBase}:${String(record.id)}`;
        candidates.set(keyValue, { ...record, restBase: type.restBase, postTypeName: type.name });
      }
    }
  }
}

const normalizedTerms = terms.map((term) => term.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
const scored = [...candidates.values()].map((candidate) => {
  const title = text(candidate.title);
  const content = text(candidate.content);
  const slug = text(candidate.slug);
  const haystack = `${title} ${slug.replaceAll("-", " ")} ${content}`.toLowerCase();
  const matchedTerms = normalizedTerms.filter((term) => haystack.includes(term));
  const identitySignals = [
    /outdoor digital sphere/i.test(title),
    /outdoor led sphere/i.test(title),
    /^outdoor-digital-sphere$/i.test(slug),
    /^outdoor-led-sphere$/i.test(slug),
    /outdoor digital sphere/i.test(content),
    /outdoor led sphere/i.test(content),
  ].filter(Boolean).length;
  return {
    objectId: Number(candidate.id),
    postType: text(candidate.type) || text(candidate.restBase),
    postTypeName: text(candidate.postTypeName),
    title,
    slug,
    status: text(candidate.status),
    parentId: Number(candidate.parent ?? 0),
    permalink: text(candidate.link),
    featuredImageId: Number(candidate.featured_media ?? 0) || null,
    contentSha256: createHash("sha256").update(text(candidate.content)).digest("hex"),
    contentWordCount: content ? content.split(/\s+/).length : 0,
    matchedTerms,
    identitySignals,
    canonical: text(object(candidate.yoast_head_json)?.canonical),
  };
}).filter((candidate) => candidate.identitySignals > 0 || candidate.matchedTerms.length > 0)
  .sort((left, right) => right.identitySignals - left.identitySignals || left.objectId - right.objectId);

const publicUrls = ["outdoor-digital-sphere", "outdoor-led-sphere", "digital-sphere", "led-sphere"];
const redirects = [];
for (const slug of publicUrls) {
  const url = `https://leddisplaywarehouse.com/${slug}/`;
  try {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
    const body = await response.text();
    redirects.push({ url, status: response.status, location: response.headers.get("location"), canonical: body.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1] ?? null });
  } catch {
    redirects.push({ url, status: 0, location: null, canonical: null });
  }
}
const inventoryFingerprint = createHash("sha256").update(JSON.stringify({ searchableTypes, candidates: scored, redirects, failedInventoryReads })).digest("hex");
console.log(JSON.stringify({ authenticatedInventoryRead: failedInventoryReads.length === 0, searchableTypes, inventoryFingerprint, candidates: scored, redirects, failedInventoryReads }, null, 2));
