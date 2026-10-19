import type { CreativeDirectionProposal, SiteStrategyProposal } from "./site-intelligence";
import type { SiteAssemblyProposal, SitePageSection } from "./site-page-generation";

export type NativePreviewTokens = {
  background: string;
  surface: string;
  accent: string;
  accentSoft: string;
  textPrimary: string;
  textSecondary: string;
  headingFamily: string;
  bodyFamily: string;
  radius: string;
};

const DEFAULT_TOKENS: NativePreviewTokens = {
  background: "#0f172a",
  surface: "#111827",
  accent: "#22d3ee",
  accentSoft: "rgba(34, 211, 238, 0.22)",
  textPrimary: "#f8fafc",
  textSecondary: "#cbd5e1",
  headingFamily: "Inter, Segoe UI, sans-serif",
  bodyFamily: "Inter, Segoe UI, sans-serif",
  radius: "16px",
};

function lower(value: string | null | undefined): string {
  return (value ?? "").toLowerCase();
}

function hasAll(value: string, tokens: string[]): boolean {
  return tokens.every((token) => value.includes(token));
}

function detectAccent(colorDirection: string): Pick<NativePreviewTokens, "accent" | "accentSoft"> {
  const normalized = lower(colorDirection);
  if (normalized.includes("cyan") || normalized.includes("electric blue")) return { accent: "#22d3ee", accentSoft: "rgba(34, 211, 238, 0.22)" };
  if (normalized.includes("amber") || normalized.includes("gold")) return { accent: "#f59e0b", accentSoft: "rgba(245, 158, 11, 0.22)" };
  if (normalized.includes("green") || normalized.includes("emerald")) return { accent: "#34d399", accentSoft: "rgba(52, 211, 153, 0.22)" };
  return { accent: DEFAULT_TOKENS.accent, accentSoft: DEFAULT_TOKENS.accentSoft };
}

function detectBackground(creative: CreativeDirectionProposal | null): Pick<NativePreviewTokens, "background" | "surface" | "textPrimary" | "textSecondary"> {
  if (!creative) return { background: DEFAULT_TOKENS.background, surface: DEFAULT_TOKENS.surface, textPrimary: DEFAULT_TOKENS.textPrimary, textSecondary: DEFAULT_TOKENS.textSecondary };
  const directional = `${creative.overallDirection} ${creative.brandInterpretation} ${creative.colorDirection} ${creative.heroTreatment}`.toLowerCase();
  if (hasAll(directional, ["dark", "navy"]) || directional.includes("technology")) {
    return { background: "#06142b", surface: "#0f233f", textPrimary: "#ecfeff", textSecondary: "#bfdbfe" };
  }
  if (directional.includes("light") || directional.includes("minimal")) {
    return { background: "#f8fafc", surface: "#ffffff", textPrimary: "#0f172a", textSecondary: "#334155" };
  }
  return { background: DEFAULT_TOKENS.background, surface: DEFAULT_TOKENS.surface, textPrimary: DEFAULT_TOKENS.textPrimary, textSecondary: DEFAULT_TOKENS.textSecondary };
}

function detectTypography(creative: CreativeDirectionProposal | null): Pick<NativePreviewTokens, "headingFamily" | "bodyFamily"> {
  const direction = lower(creative?.typographyDirection);
  if (direction.includes("serif")) return { headingFamily: "Merriweather, Georgia, serif", bodyFamily: "Inter, Segoe UI, sans-serif" };
  if (direction.includes("condensed")) return { headingFamily: "Roboto Condensed, Inter, sans-serif", bodyFamily: "Inter, Segoe UI, sans-serif" };
  return { headingFamily: "Inter, Segoe UI, sans-serif", bodyFamily: "Inter, Segoe UI, sans-serif" };
}

export function deriveNativePreviewTokens(input: { strategy: SiteStrategyProposal | null; creative: CreativeDirectionProposal | null }): NativePreviewTokens {
  const background = detectBackground(input.creative);
  const accent = detectAccent(input.creative?.colorDirection ?? input.strategy?.positioning ?? "");
  const typography = detectTypography(input.creative);
  return { ...DEFAULT_TOKENS, ...background, ...accent, ...typography };
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function safeText(value: string): string {
  return stripTags(value).replace(/script/gi, "").trim();
}

export function pageWordCount(page: SiteAssemblyProposal["pages"][number]): number {
  const text = safeText([page.h1, page.metaDescription, ...page.sections.flatMap((section) => [section.heading, ...section.body])].join(" "));
  return text ? text.split(/\s+/).length : 0;
}

export function sectionParagraphs(section: SitePageSection): string[] {
  if (section.presentation !== "STEPS") return section.body.map((entry) => safeText(entry)).filter(Boolean);
  return section.body
    .flatMap((entry) => entry.split(/\s(?=\d+\.\s)/g))
    .map((entry) => safeText(entry.replace(/^\d+\.\s*/, "")))
    .filter(Boolean);
}
