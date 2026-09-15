import { createHash } from "node:crypto";
import nextEnv from "@next/env";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const WORKFLOW_ID = "bIDXxyWnY22G8zJC";
const BEFORE_VERSION_ID = "515d8389-f901-4e5c-a203-4d52026d71d1";
const V1_WORKFLOW_FINGERPRINT = "e42c598bd0a8e358da74edeb7063d398e992ecc83dca679508a94a3ef406fb10";
const PREVIOUS_CONTRACT_VERSION = "GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_V1";
const CONTRACT_VERSION = "GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_V1_1";
const FIELD_NAMES = [
  "generation_claim_contract_version",
  "generation_claim_contract_json",
  "classified_source_inventory_json",
  "product_authority_json",
  "claim_authority_json",
  "reference_authority_classification_json",
];

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function node(workflow, name) {
  const value = workflow.nodes.find((candidate) => candidate.name === name);
  if (!value) throw new Error(`Missing workflow node: ${name}`);
  return value;
}

function patchedParameters(workflow) {
  const normalizer = node(workflow, "Get row(s) in sheet");
  const primary = node(workflow, "Message a model");
  const expansion = node(workflow, "Expand GLW Content");

  let code = normalizer.parameters.jsCode;
  const publishingAnchor = "const publishingMode = normalizePublishingMode(";
  if (!code.includes(publishingAnchor) || code.includes("generation_claim_contract_json")) {
    throw new Error("NORMALIZER_PATCH_PRECONDITION_FAILED");
  }
  const validation = `const claimContract = workflowContext.referenceGenerationClaimContract ?? page.referenceGenerationClaimContract ?? null;
const referenceAuthority = workflowContext.referenceGenerationAuthority ?? page.referenceGenerationAuthority ?? null;
const isCampaignReference = additionalInstructions.startsWith('CAMPAIGN REFERENCE PAGE');
if (isCampaignReference) {
  if (!claimContract || claimContract.version !== '${CONTRACT_VERSION}') throw new Error('GLW_MODEL_CLAIM_CONTRACT_REQUIRED');
  if (!referenceAuthority || !Array.isArray(referenceAuthority.references)) throw new Error('GLW_MODEL_CLASSIFIED_SOURCE_INVENTORY_REQUIRED');
  if (!referenceAuthority.productAuthority || referenceAuthority.productAuthority.known !== true || !referenceAuthority.productAuthority.path) throw new Error('GLW_MODEL_PRODUCT_AUTHORITY_REQUIRED');
  if (!claimContract.qaPolicyVersion || !Array.isArray(claimContract.prohibitedWithoutExplicitAuthority)) throw new Error('GLW_MODEL_CLAIM_AUTHORITY_REQUIRED');
  if (referenceAuthority.references.some((reference) => !reference.referenceId || !reference.fileName || !reference.role || !reference.scope)) throw new Error('GLW_MODEL_REFERENCE_CLASSIFICATION_INVALID');
}
const generationClaimContractJson = JSON.stringify(claimContract);
const classifiedSourceInventoryJson = JSON.stringify(referenceAuthority);
const productAuthorityJson = JSON.stringify(referenceAuthority?.productAuthority ?? null);
const claimAuthorityJson = JSON.stringify({
  qaPolicyVersion: claimContract?.qaPolicyVersion ?? null,
  prohibitedWithoutExplicitAuthority: claimContract?.prohibitedWithoutExplicitAuthority ?? [],
});
const referenceAuthorityClassificationJson = JSON.stringify({
  authoritativeFactReferenceIds: referenceAuthority?.authoritativeFactReferenceIds ?? [],
  visualOrContentReferenceIds: referenceAuthority?.visualOrContentReferenceIds ?? [],
  references: referenceAuthority?.references ?? [],
});

`;
  code = code.replace(publishingAnchor, validation + publishingAnchor);

  const outputAnchor = `      additional_instructions:
        additionalInstructions,

      status: 'Ready',`;
  if (!code.includes(outputAnchor)) throw new Error("NORMALIZER_OUTPUT_PRECONDITION_FAILED");
  code = code.replace(outputAnchor, `      additional_instructions:
        additionalInstructions,
      generation_claim_contract_version: claimContract?.version ?? '',
      generation_claim_contract_json: generationClaimContractJson,
      classified_source_inventory_json: classifiedSourceInventoryJson,
      product_authority_json: productAuthorityJson,
      claim_authority_json: claimAuthorityJson,
      reference_authority_classification_json: referenceAuthorityClassificationJson,

      status: 'Ready',`);

  const promptBlock = `
GENERATION CLAIM CONTRACT VERSION: {{ $('Get row(s) in sheet').first().json.generation_claim_contract_version }}
GENERATION CLAIM CONTRACT JSON: {{ $('Get row(s) in sheet').first().json.generation_claim_contract_json }}
CLASSIFIED SOURCE INVENTORY JSON: {{ $('Get row(s) in sheet').first().json.classified_source_inventory_json }}
PRODUCT AUTHORITY JSON: {{ $('Get row(s) in sheet').first().json.product_authority_json }}
CLAIM AUTHORITY JSON: {{ $('Get row(s) in sheet').first().json.claim_authority_json }}
REFERENCE AUTHORITY CLASSIFICATION JSON: {{ $('Get row(s) in sheet').first().json.reference_authority_classification_json }}

MANDATORY MODEL AUTHORITY RULES
- For GLW campaign references, all six structured fields above are mandatory. Refuse generation if any is missing or malformed.
- content_reference, product_image, and image_style are not authoritative_fact.
- State facts only when explicitly supported by authoritativeFactReferenceIds or productAuthority.
- Unsupported factual classes must be omitted. Unknown facts must be omitted or framed only as questions or planning considerations requiring confirmation.
- Conceptual applications must not be stated as deployments, capabilities, customers, adoption, or results.
`;

  const primaryParameters = structuredClone(primary.parameters);
  const primaryAnchor = "ADDITIONAL INSTRUCTIONS: {{ $('Get row(s) in sheet').first().json.additional_instructions || '' }}";
  const primaryText = primaryParameters.responses.values[0].content;
  if (!primaryText.includes(primaryAnchor) || primaryText.includes("GENERATION CLAIM CONTRACT VERSION:")) {
    throw new Error("PRIMARY_PATCH_PRECONDITION_FAILED");
  }
  primaryParameters.responses.values[0].content = primaryText.replace(primaryAnchor, primaryAnchor + promptBlock);

  const expansionParameters = structuredClone(expansion.parameters);
  const expansionAnchor = "\n\nABSOLUTE ISOLATION RULES";
  const expansionText = expansionParameters.responses.values[0].content;
  if (!expansionText.includes(expansionAnchor) || expansionText.includes("GENERATION CLAIM CONTRACT VERSION:")) {
    throw new Error("EXPANSION_PATCH_PRECONDITION_FAILED");
  }
  expansionParameters.responses.values[0].content = expansionText.replace(expansionAnchor, promptBlock + expansionAnchor);

  return {
    normalizer: { ...normalizer.parameters, jsCode: code },
    primary: primaryParameters,
    expansion: expansionParameters,
  };
}

function v11Parameters(workflow) {
  const normalizer = node(workflow, "Get row(s) in sheet");
  const primary = node(workflow, "Message a model");
  const expansion = node(workflow, "Expand GLW Content");
  const upgradeNormalizer = (value) => {
    let code = value;
    const previousVersionCheck = `claimContract.version !== '${PREVIOUS_CONTRACT_VERSION}'`;
    if (!code.includes(previousVersionCheck) || code.includes("GLW_MODEL_SOURCE_TO_CLAIM_MAPPING_INVALID")) {
      throw new Error("V1_1_NORMALIZER_PRECONDITION_FAILED");
    }
    code = code.replace(previousVersionCheck, `claimContract.version !== '${CONTRACT_VERSION}'`);
    const classificationCheck = "  if (referenceAuthority.references.some((reference) => !reference.referenceId || !reference.fileName || !reference.role || !reference.scope)) throw new Error('GLW_MODEL_REFERENCE_CLASSIFICATION_INVALID');";
    const v11Checks = `${classificationCheck}
  if (!Array.isArray(referenceAuthority.authoritativeFactReferenceIds) || !Array.isArray(referenceAuthority.visualOrContentReferenceIds) || !Array.isArray(referenceAuthority.supportedClaimMappings)) throw new Error('GLW_MODEL_SOURCE_TO_CLAIM_MAPPING_INVALID');
  if (referenceAuthority.productAuthority.authorityScope !== 'NAVIGATION_AND_PRODUCT_IDENTITY_ONLY') throw new Error('GLW_MODEL_PRODUCT_AUTHORITY_SCOPE_INVALID');
  const authoritativeIds = new Set(referenceAuthority.authoritativeFactReferenceIds);
  if (referenceAuthority.supportedClaimMappings.some((mapping) => !mapping || !authoritativeIds.has(mapping.authoritativeFactReferenceId) || !mapping.claimClass || !mapping.supportedAssertion)) throw new Error('GLW_MODEL_SOURCE_TO_CLAIM_MAPPING_INVALID');`;
    if (!code.includes(classificationCheck)) throw new Error("V1_1_CLASSIFICATION_PRECONDITION_FAILED");
    return code.replace(classificationCheck, v11Checks);
  };
  const upgradePrompt = (value) => {
    const previousRule = "- State facts only when explicitly supported by authoritativeFactReferenceIds or productAuthority.";
    if (!value.includes(previousRule) || value.includes("NO_AUTHORITY_MAPPING => NO_PROTECTED_FACTUAL_ASSERTION")) {
      throw new Error("V1_1_PROMPT_PRECONDITION_FAILED");
    }
    return value.replace(previousRule, [
      "- NO_AUTHORITY_MAPPING => NO_PROTECTED_FACTUAL_ASSERTION.",
      "- Every protected factual sentence requires authoritativeFactReferenceId plus an exact supportedAssertion mapping.",
      "- productAuthority is navigation and product identity only; it never establishes specifications, capabilities, performance, installation, service, warranty, pricing, interactivity, or remote management.",
      "- With no mapping, use a direct buyer question beginning What, Which, Does the selected supplier confirm, or Can the selected supplier confirm.",
      "- Omit unsupported trends, adoption, growth, popularity, market movement, industry direction, and regional demand; replace only with conceptual planning or application guidance.",
      "- Generic product knowledge is not authority. Keep headings structurally separate from claim sentences.",
    ].join("\n"));
  };
  const primaryParameters = structuredClone(primary.parameters);
  primaryParameters.responses.values[0].content = upgradePrompt(primaryParameters.responses.values[0].content);
  const expansionParameters = structuredClone(expansion.parameters);
  expansionParameters.responses.values[0].content = upgradePrompt(expansionParameters.responses.values[0].content);
  return {
    normalizer: { ...normalizer.parameters, jsCode: upgradeNormalizer(normalizer.parameters.jsCode) },
    primary: primaryParameters,
    expansion: expansionParameters,
  };
}

function verification(workflow) {
  const normalizer = JSON.stringify(node(workflow, "Get row(s) in sheet").parameters);
  const primary = JSON.stringify(node(workflow, "Message a model").parameters);
  const expansion = JSON.stringify(node(workflow, "Expand GLW Content").parameters);
  return {
    workflowId: workflow.id,
    versionId: workflow.versionId,
    activeVersionId: workflow.activeVersionId,
    fingerprint: fingerprint(workflow),
    beforeVersionId: BEFORE_VERSION_ID,
    normalizerFailClosed: [
      "GLW_MODEL_CLAIM_CONTRACT_REQUIRED",
      "GLW_MODEL_CLASSIFIED_SOURCE_INVENTORY_REQUIRED",
      "GLW_MODEL_PRODUCT_AUTHORITY_REQUIRED",
      "GLW_MODEL_CLAIM_AUTHORITY_REQUIRED",
      "GLW_MODEL_REFERENCE_CLASSIFICATION_INVALID",
    ].every((marker) => normalizer.includes(marker)),
    contractVersion: normalizer.includes(CONTRACT_VERSION)
      ? CONTRACT_VERSION
      : normalizer.includes(PREVIOUS_CONTRACT_VERSION)
        ? PREVIOUS_CONTRACT_VERSION
        : null,
    sourceToClaimMappingRequired: normalizer.includes("GLW_MODEL_SOURCE_TO_CLAIM_MAPPING_INVALID"),
    productAuthorityNavigationOnly: normalizer.includes("NAVIGATION_AND_PRODUCT_IDENTITY_ONLY"),
    normalizedFields: Object.fromEntries(FIELD_NAMES.map((field) => [field, normalizer.includes(field)])),
    primaryModelFields: Object.fromEntries(FIELD_NAMES.map((field) => [field, primary.includes(field)])),
    expansionModelFields: Object.fromEntries(FIELD_NAMES.map((field) => [field, expansion.includes(field)])),
    freeFormOnlyFallbackPossible: !normalizer.includes("GLW_MODEL_CLAIM_CONTRACT_REQUIRED"),
    primaryModelV11Rules: primary.includes("NO_AUTHORITY_MAPPING => NO_PROTECTED_FACTUAL_ASSERTION"),
    expansionModelV11Rules: expansion.includes("NO_AUTHORITY_MAPPING => NO_PROTECTED_FACTUAL_ASSERTION"),
  };
}

async function main() {
  const mode = process.argv[2] ?? "verify";
  const client = new Client({ name: "genesis-glw-model-contract-repair", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(process.env.GLW_N8N_MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${process.env.GLW_N8N_MCP_TOKEN}` } },
  });
  try {
    await client.connect(transport);
    const current = (await client.callTool({ name: "get_workflow_details", arguments: { workflowId: WORKFLOW_ID } })).structuredContent.workflow;
    if (mode === "verify") {
      console.log(JSON.stringify(verification(current), null, 2));
      return;
    }
    if (!["apply", "apply-v1-1"].includes(mode)) throw new Error("Usage: node scripts/glw-n8n-model-contract-repair.mjs [verify|apply|apply-v1-1]");
    if (mode === "apply" && current.versionId !== BEFORE_VERSION_ID) throw new Error(`WORKFLOW_VERSION_CHANGED:${current.versionId}`);
    if (mode === "apply-v1-1" && fingerprint(current) !== V1_WORKFLOW_FINGERPRINT) throw new Error(`WORKFLOW_FINGERPRINT_CHANGED:${fingerprint(current)}`);
    const parameters = mode === "apply-v1-1" ? v11Parameters(current) : patchedParameters(current);
    const result = await client.callTool({
      name: "update_workflow",
      arguments: {
        workflowId: WORKFLOW_ID,
        operations: [
          { type: "updateNodeParameters", nodeName: "Get row(s) in sheet", parameters: parameters.normalizer },
          { type: "updateNodeParameters", nodeName: "Message a model", parameters: parameters.primary },
          { type: "updateNodeParameters", nodeName: "Expand GLW Content", parameters: parameters.expansion },
        ],
      },
    });
    if (result.isError) throw new Error("WORKFLOW_UPDATE_FAILED");
    const updated = (await client.callTool({ name: "get_workflow_details", arguments: { workflowId: WORKFLOW_ID } })).structuredContent.workflow;
    console.log(JSON.stringify(verification(updated), null, 2));
  } finally {
    await client.close().catch(() => undefined);
  }
}

await main();
