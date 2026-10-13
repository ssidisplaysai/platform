import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { canonicalizeGlwZeroAuthorityClaims } from "../src/modules/glw/zero-authority-claim-canonicalization";
import { evaluateGlwReferenceClaimAuthority, type GlwClaimAuthorityFinding } from "../src/modules/glw/reference-claim-authority";
import { evaluateGlwGeneratedContentQa } from "../src/modules/glw/generated-content-qa";

const JOB_ID = "dbb8574d-c8d5-43c0-aba1-4d445589b4f2";
const RAW_SHA = "6093ef4bae6f3a0ff1d7c601571f718cc361e6a479d879fe0049ad4b09ac7955";
const persistenceRoot = process.env.GLW_FORENSIC_PERSISTENCE_DIR?.trim();
if (!persistenceRoot) throw new Error("GLW_FORENSIC_PERSISTENCE_DIR_REQUIRED");

type ForensicRepository = {
  data: {
    records: Array<{
      jobId: string;
      externalExecutionId: string | null;
      generatedDraft: {
        title: string;
        contentHtml: string;
        slug: string;
        excerpt: string | null;
        seoTitle: string | null;
        metaDescription: string | null;
        focusKeyphrase: string | null;
      };
      qaChecks: { claimAuthority: { findings: GlwClaimAuthorityFinding[] } };
    }>;
  };
};

const repository = JSON.parse(
  readFileSync(join(persistenceRoot, "glw-page-execution-repository.json"), "utf8"),
) as ForensicRepository;
const job = repository.data.records.find((record) => record.jobId === JOB_ID);
if (!job) throw new Error("FORENSIC_JOB_NOT_FOUND");
const rawSha = createHash("sha256").update(job.generatedDraft.contentHtml).digest("hex");
if (rawSha !== RAW_SHA) throw new Error("FORENSIC_RAW_ARTIFACT_CHANGED");

const result = canonicalizeGlwZeroAuthorityClaims({
  rawArtifact: job.generatedDraft,
  authoritativeFactReferenceIds: [],
  findings: job.qaChecks.claimAuthority.findings,
});
if (!result.ok || !result.canonicalizedArtifact) throw new Error("FORENSIC_CANONICALIZATION_BLOCKED");

const claimAuthority = evaluateGlwReferenceClaimAuthority({
  artifact: result.canonicalizedArtifact,
  authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] },
});
const qa = evaluateGlwGeneratedContentQa({
  artifact: result.canonicalizedArtifact,
  request: { pageType: "state_service", stateCode: "IN", stateName: "Indiana", cityName: null, productTopic: "Outdoor Digital Sphere", canonicalPath: "outdoor-digital-sphere/indiana" } as never,
  siteDomain: "LEDDisplayWarehouse.com",
  minimumWordCount: 1500,
  requiredCanonicalProductLink: { url: "/outdoor-digital-sphere/", anchorText: "Outdoor Digital Sphere" },
  authorizedComparisonStateCodes: [],
});

const evidence = {
  evidenceType: "GLW_ZERO_AUTHORITY_CANONICALIZATION_CANDIDATE_V1",
  jobId: job.jobId,
  n8nExecutionId: job.externalExecutionId,
  durableArtifactModified: false,
  wordpressMutationPerformed: false,
  modelInvoked: false,
  n8nInvoked: false,
  rawArtifact: job.generatedDraft,
  canonicalizedArtifact: result.canonicalizedArtifact,
  transformationReceipt: result.receipt,
  validation: {
    claimAuthorityPolicyVersion: claimAuthority.policyVersion,
    unsupportedFactualClaims: claimAuthority.findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED").length,
    protectedFactsWithoutAuthorityMapping: claimAuthority.findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED").length,
    sourceToClaimMappingFailures: claimAuthority.findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED").length,
    conceptualClaims: claimAuthority.findings.filter((finding) => finding.authorityStatus === "APPROVED_CONCEPTUAL").length,
    generatedContentQaPassed: qa.ok,
    wordCount: qa.wordCount,
    checks: qa.checks,
    failureReasons: qa.failureReasons,
  },
};

if (process.argv.includes("--write")) {
  const outputPath = join(process.cwd(), "docs/genesis/evidence/glw-zero-authority-canonicalization-644114.json");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(outputPath);
} else {
  console.log(JSON.stringify(evidence, null, 2));
}
