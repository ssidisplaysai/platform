import {
  GMP_GENERATION_PROVIDER_ID,
  GMP_PROMPT_ADAPTER_VERSION,
  GMP_SECTION_OUTPUT_SCHEMA_VERSION,
  type GmpCanonicalGenerationInput,
  type GmpStructuredSectionOutput,
} from "./content-models";
import { validateSectionOutput } from "./content-contracts";

export type GmpPromptAdapterOutput = {
  provider: string;
  modelIdentifier: string;
  promptAdapterVersion: string;
  inputFingerprint: string;
  outputSchemaVersion: string;
  system: string;
  user: string;
};

export type GmpGenerationProvider = {
  providerId: string;
  modelIdentifier: string;
  generateSection: (input: GmpCanonicalGenerationInput, prompt: GmpPromptAdapterOutput) => Promise<GmpStructuredSectionOutput>;
  reviseSection: (input: GmpCanonicalGenerationInput, prompt: GmpPromptAdapterOutput, instruction: string) => Promise<GmpStructuredSectionOutput>;
  repairSection: (input: GmpCanonicalGenerationInput, prompt: GmpPromptAdapterOutput) => Promise<GmpStructuredSectionOutput>;
  validateOutput: (output: GmpStructuredSectionOutput) => Promise<{ ok: true } | { ok: false; error: string }>;
};

export function createGmpPromptAdapter(input: { provider?: string; modelIdentifier?: string }) {
  const provider = input.provider ?? GMP_GENERATION_PROVIDER_ID;
  const modelIdentifier = input.modelIdentifier ?? "gpt-5.4-structured";

  return {
    provider,
    modelIdentifier,
    promptAdapterVersion: GMP_PROMPT_ADAPTER_VERSION,
    buildPrompt(payload: { input: GmpCanonicalGenerationInput; inputFingerprint: string }): GmpPromptAdapterOutput {
      const sectionKey = String(payload.input.section.sectionKey ?? payload.input.section.sectionId ?? "section");
      return {
        provider,
        modelIdentifier,
        promptAdapterVersion: GMP_PROMPT_ADAPTER_VERSION,
        inputFingerprint: payload.inputFingerprint,
        outputSchemaVersion: GMP_SECTION_OUTPUT_SCHEMA_VERSION,
        system: "Generate structured section content that only uses approved knowledge, evidence, and restrictions.",
        user: JSON.stringify({
          sectionKey,
          audience: payload.input.brief.audience,
          tone: payload.input.brief.toneGuidance,
          claims: payload.input.claims,
          restrictions: payload.input.restrictions,
          seoRequirements: payload.input.seoRequirements,
          accessibilityRequirements: payload.input.accessibilityRequirements,
        }),
      };
    },
  };
}

function deterministicBody(input: GmpCanonicalGenerationInput, action: "generate" | "revise" | "repair", instruction?: string): string {
  const topic = String(input.brief.primaryTopic ?? input.page.title ?? input.page.name ?? "the topic");
  const audience = String(input.brief.audience ?? "the intended audience");
  const proof = input.proofPoints[0] ?? input.evidenceReferences[0] ?? "approved evidence";
  const suffix = action === "revise" && instruction ? ` Revision focus: ${instruction}.` : action === "repair" ? " This revision repairs previously unresolved requirements." : "";
  return `${String(input.section.workingHeading ?? input.section.heading ?? topic)} explains ${topic} for ${audience}. It stays aligned with approved claims and references ${proof}.${suffix}`;
}

export function createDeterministicGmpGenerationProvider(input?: { providerId?: string; modelIdentifier?: string }): GmpGenerationProvider {
  return {
    providerId: input?.providerId ?? GMP_GENERATION_PROVIDER_ID,
    modelIdentifier: input?.modelIdentifier ?? "gpt-5.4-structured",
    async generateSection(payload, prompt) {
      return {
        sectionKey: String(payload.section.sectionKey ?? payload.section.sectionId ?? "section"),
        heading: String(payload.section.workingHeading ?? payload.section.heading ?? payload.page.title ?? "Section"),
        body: deterministicBody(payload, "generate"),
        cta: { label: payload.ctaRequirements[0] ?? payload.brief.primaryCta ?? "Contact us" },
        claimsUsed: payload.claims,
        knowledgeRecordsUsed: payload.approvedKnowledge.map((record) => ({ knowledgeRecordId: String(record.knowledgeRecordId ?? "unknown"), version: Number(record.version ?? 1) })),
        evidenceReferencesUsed: payload.evidenceReferences,
        internalLinksSuggested: payload.internalLinkRequirements,
        mediaGuidance: { preferred: payload.section.mediaRequirement ?? { type: "supporting_media" } },
        warnings: [],
        unresolvedRequirements: [],
        generationNotes: [prompt.promptAdapterVersion, prompt.modelIdentifier],
        outputSchemaVersion: GMP_SECTION_OUTPUT_SCHEMA_VERSION,
      };
    },
    async reviseSection(payload, prompt, instruction) {
      return {
        ...(await this.generateSection(payload, prompt)),
        body: deterministicBody(payload, "revise", instruction),
        generationNotes: [prompt.promptAdapterVersion, prompt.modelIdentifier, instruction],
      };
    },
    async repairSection(payload, prompt) {
      return {
        ...(await this.generateSection(payload, prompt)),
        body: deterministicBody(payload, "repair"),
      };
    },
    async validateOutput(output) {
      return validateSectionOutput(output);
    },
  };
}