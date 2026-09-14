import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateGlwReferenceClaimAuthority } from "../src/modules/glw/reference-claim-authority";

const root = process.env.GLW_FORENSIC_PERSISTENCE_DIR?.trim();
if (!root) throw new Error("GLW_FORENSIC_PERSISTENCE_DIR is required.");

const repositoryPath = join(root, "glw-page-execution-repository.json");
const bytesBefore = readFileSync(repositoryPath);
const envelope = JSON.parse(bytesBefore.toString("utf8")) as {
  data: { records: Array<{ jobId: string; generatedDraft: { contentHtml: string } | null }> };
};
const job = envelope.data.records.find(
  (record) => record.jobId === "3df15069-2cd8-4aec-93f3-70a9f5ee3029",
);
if (!job?.generatedDraft) throw new Error("Certified failed Illinois artifact was not found.");

const sha256 = createHash("sha256").update(job.generatedDraft.contentHtml).digest("hex");
if (sha256 !== "eed2b6450c8ba975c78e51e5f603993a4306632e48946ffb64c2128b7b404371") {
  throw new Error(`Certified artifact hash mismatch: ${sha256}`);
}

const result = evaluateGlwReferenceClaimAuthority({ artifact: job.generatedDraft as never });
const unsupported = result.findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED");
const bytesAfter = readFileSync(repositoryPath);
if (!bytesAfter.equals(bytesBefore)) throw new Error("Forensic repository changed during read-only proof.");

const packEnvelope = JSON.parse(readFileSync(join(root, "glw-campaign-reference-repository.json"), "utf8")) as {
  data: { packs: Array<{ campaignId: string; instructions: string; references: Array<{ storagePath: string }> }> };
};
const campaignId = "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview";
const pack = packEnvelope.data.packs.find((candidate) => candidate.campaignId === campaignId);
if (!pack || pack.references.length !== 1) throw new Error("Exact campaign authority pack was not found.");
const campaignInstructionFingerprint = createHash("sha256").update(pack.instructions.trim()).digest("hex");
const referenceFingerprint = createHash("sha256").update(readFileSync(pack.references[0].storagePath)).digest("hex");
const productAuthority = { href: "/outdoor-digital-sphere/", anchorText: "Outdoor Digital Sphere", authorityClass: "product" };
const productAuthorityFingerprint = createHash("sha256").update(JSON.stringify(productAuthority)).digest("hex");

console.log(JSON.stringify({
  sha256,
  policyVersion: result.policyVersion,
  stillFails: !result.ok,
  unsupportedCount: unsupported.length,
  unsupportedClasses: [...new Set(unsupported.map((finding) => finding.claimClass))],
  failures: result.failureReasons,
  campaignInstructionFingerprint,
  referenceFingerprint,
  productAuthorityFingerprint,
  repositoryUnchanged: true,
}, null, 2));