import { load } from "cheerio";

import type { GlwGeneratedDraftArtifact } from "./page-execution";
import {
  applyProjectorEnclosurePresentationAuthority,
  PROJECTOR_ENCLOSURE_PRESENTATION_CONTRACT,
} from "./projector-enclosure-presentation-authority";

export const SSI_FAN_COOLED_PROJECTOR_PRODUCT_ID = "prod-ssi-fan-cooled-projector-enclosures" as const;

export type ProjectorEnclosureVisualIntent =
  | "HERO_PRODUCT"
  | "OUTDOOR_MAPPING"
  | "OUTDOOR_THEATER_HOSPITALITY"
  | "OUTDOOR_COMMERCIAL_EVENT"
  | "INDOOR_SUPPORT";

export type ProjectorEnclosureVisualPlanItem = {
  visualId: string;
  intent: ProjectorEnclosureVisualIntent;
  environment: "OUTDOOR" | "INDOOR";
  placement: "HERO" | "BODY";
  required: boolean;
};

export type ProjectorEnclosureVisualPlan = {
  version: "PROJECTOR_ENCLOSURE_VISUAL_PLAN_V1";
  productId: string;
  heroProductForwardAllowed: true;
  bodyOutdoorTargetCount: 3;
  bodyIndoorMaximumCount: 1;
  visuals: readonly ProjectorEnclosureVisualPlanItem[];
};

type ExtractedContent = {
  intro: string;
  planning: string[];
  useCases: string[];
  buyerQuestions: string[];
  ctaSentence: string;
};

function text(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function uniqueSentences(values: readonly string[], maximum: number): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = text(value).toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(text(value));
    if (output.length >= maximum) break;
  }
  return output;
}

function parseParagraphs(html: string): string[] {
  const $ = load(html, null, false);
  return $("p")
    .map((_, node) => text($(node).text()))
    .get()
    .filter((value) => value.length >= 48);
}

function parseBullets(html: string): string[] {
  const $ = load(html, null, false);
  return $("li")
    .map((_, node) => text($(node).text()))
    .get()
    .filter((value) => value.length >= 24);
}

function parseBuyerQuestions(values: readonly string[]): string[] {
  const extracted = values
    .flatMap((value) => value.split(/(?<=[.?!])\s+/g))
    .map((value) => text(value))
    .filter((value) => /\?$/.test(value));

  const defaults = [
    "What environmental conditions must the selected enclosure support for this installation?",
    "Does the selected supplier confirm compatibility with the intended projector model and lens setup?",
    "What thermal-management requirements should the project team verify before final product selection?",
    "Which service-access and mounting constraints should be documented before procurement?",
  ];

  return uniqueSentences([...extracted, ...defaults], 6);
}

function deriveCtaSentence(values: readonly string[]): string {
  const sentence = values.find((value) => /contact|quote|project details|request/i.test(value));
  return sentence
    ? text(sentence)
    : "Share projector model, mounting approach, and site conditions for an exact fit review and draft quote guidance.";
}

function extractContent(sourceHtml: string): ExtractedContent {
  const paragraphs = uniqueSentences(parseParagraphs(sourceHtml), 16);
  const bullets = uniqueSentences(parseBullets(sourceHtml), 12);
  const intro = paragraphs[0]
    ?? "Fan-cooled projector enclosure planning should connect intended projection experiences to project-specific installation constraints and authority-verified product boundaries.";

  const planning = uniqueSentences(
    [
      ...paragraphs.filter((value) => /plan|project|requirements|conditions|confirm|verify|compatibility|mounting|service|environment/i.test(value)),
      ...bullets,
    ],
    7,
  );

  const useCases = uniqueSentences(
    [
      ...paragraphs.filter((value) => /outdoor|projection mapping|hospitality|event|commercial|theater|venue|installation/i.test(value)),
      ...bullets,
    ],
    6,
  );

  const buyerQuestions = parseBuyerQuestions([...paragraphs, ...bullets]);
  const ctaSentence = deriveCtaSentence([...paragraphs, ...bullets]);

  return {
    intro,
    planning,
    useCases,
    buyerQuestions,
    ctaSentence,
  };
}

export function buildProjectorEnclosureVisualPlan(input: {
  productId: string;
  pageType: "general_service" | "state_service" | "city_service";
}): ProjectorEnclosureVisualPlan | null {
  if (input.productId !== SSI_FAN_COOLED_PROJECTOR_PRODUCT_ID) return null;

  return {
    version: "PROJECTOR_ENCLOSURE_VISUAL_PLAN_V1",
    productId: input.productId,
    heroProductForwardAllowed: true,
    bodyOutdoorTargetCount: 3,
    bodyIndoorMaximumCount: 1,
    visuals: [
      { visualId: "hero-product", intent: "HERO_PRODUCT", environment: "INDOOR", placement: "HERO", required: true },
      { visualId: "outdoor-mapping", intent: "OUTDOOR_MAPPING", environment: "OUTDOOR", placement: "BODY", required: true },
      { visualId: "outdoor-theater", intent: "OUTDOOR_THEATER_HOSPITALITY", environment: "OUTDOOR", placement: "BODY", required: true },
      { visualId: "outdoor-commercial", intent: "OUTDOOR_COMMERCIAL_EVENT", environment: "OUTDOOR", placement: "BODY", required: true },
      { visualId: "indoor-support", intent: "INDOOR_SUPPORT", environment: "INDOOR", placement: "BODY", required: false },
    ],
  };
}

export function assembleProjectorEnclosureRichReference(input: {
  artifact: GlwGeneratedDraftArtifact;
  productTopic: string;
  stateName: string;
  cityName: string | null;
  visualPlan: ProjectorEnclosureVisualPlan;
  productImageUrl: string;
  outdoorVisualUrl: string;
  indoorVisualUrl?: string | null;
  canonicalProductHref: string;
}): GlwGeneratedDraftArtifact {
  const extracted = extractContent(input.artifact.contentHtml);
  const location = input.cityName
    ? `${input.cityName}, ${input.stateName}`
    : input.stateName;
  const useCases = extracted.useCases.length > 0
    ? extracted.useCases
    : [
      "Outdoor projection mapping programs that prioritize audience experience while keeping enclosure review grounded in exact equipment and site data.",
      "Hospitality and outdoor theater programming where projection quality and service access requirements are reviewed before final enclosure selection.",
      "Commercial and event environments that require project-specific confirmation of mounting, airflow, weather exposure boundaries, and maintenance access.",
    ];

  const planning = extracted.planning.length > 0
    ? extracted.planning
    : [
      "Document projector model, lens, mounting direction, and required service-clearance zones before selecting enclosure size.",
      "Confirm whether the installation is indoor, covered, or exposed and validate whether climate-controlled alternatives are required.",
      "Capture environmental conditions, schedule constraints, and maintenance responsibilities early so supplier confirmation can be exact.",
    ];

  const faq = extracted.buyerQuestions;
  const indoorSection = input.indoorVisualUrl
    ? `<section class="saw-split" data-reference-section="APPLICATIONS" data-visual-intent="INDOOR_SUPPORT"><img src="${escapeHtml(input.indoorVisualUrl)}" alt="Indoor supporting projector application context"><div class="saw-split-copy"><p class="saw-kicker">Indoor support context</p><h2>Indoor supporting application context</h2><p>Indoor or sheltered spaces can be part of the same buyer journey when the project team confirms sightlines, service access, heat management, and mounting constraints against the selected projector and enclosure model.</p></div></section>`
    : "";

  const body = [
    `<main class="saw-page" data-site-presentation-authority="${PROJECTOR_ENCLOSURE_PRESENTATION_CONTRACT}" data-visual-plan-version="${input.visualPlan.version}">`,
    `<section class="saw-hero" data-reference-section="HERO" data-visual-intent="HERO_PRODUCT" style="background-image:linear-gradient(100deg,rgba(14,39,60,.92),rgba(14,39,60,.72) 52%,rgba(14,39,60,.24)),url('${escapeHtml(input.outdoorVisualUrl)}');background-size:cover;background-position:center;">`,
    `<div class="saw-wrap"><p class="saw-kicker">ProjectorEnclosure • ${escapeHtml(location)}</p><h1>${escapeHtml(input.artifact.title)}</h1><p class="saw-copy">${escapeHtml(extracted.intro)}</p><div class="saw-actions"><a class="saw-button" href="${escapeHtml(input.canonicalProductHref)}">Review ${escapeHtml(input.productTopic)}</a><a class="saw-button alt" href="/contact-us-projection-enclosure/">Request Project Review</a></div></div>`,
    `</section>`,
    `<section id="product-authority" class="saw-product" data-reference-section="PRODUCT_IDENTITY"><figure><img src="${escapeHtml(input.productImageUrl)}" alt="${escapeHtml(input.productTopic)} approved product authority visual"></figure><div class="saw-product-copy"><p class="saw-kicker">Product identity</p><h2>${escapeHtml(input.productTopic)} for ${escapeHtml(location)}</h2><p>${escapeHtml(planning[0] ?? extracted.intro)}</p><p>${escapeHtml(planning[1] ?? planning[0] ?? extracted.intro)}</p></div></section>`,
    `<section class="saw-split" data-reference-section="APPLICATIONS" data-visual-intent="OUTDOOR_MAPPING"><img src="${escapeHtml(input.outdoorVisualUrl)}" alt="Outdoor projection mapping application context"><div class="saw-split-copy"><p class="saw-kicker">Experience-first visual</p><h2>Outdoor projection mapping context</h2><p>${escapeHtml(useCases[0] ?? planning[0] ?? extracted.intro)}</p></div></section>`,
    `<section class="saw-application" data-reference-section="VISUAL_APPLICATION" data-visual-intent="OUTDOOR_THEATER_HOSPITALITY" style="background-image:linear-gradient(0deg,rgba(13,35,52,.88),rgba(13,35,52,.22)),url('${escapeHtml(input.outdoorVisualUrl)}');background-size:cover;background-position:center;"><div class="saw-wrap"><p class="saw-kicker">Application focus</p><h2>Outdoor theater and hospitality planning</h2><p>${escapeHtml(useCases[1] ?? planning[1] ?? extracted.intro)}</p></div></section>`,
    `<section class="saw-split" data-reference-section="APPLICATIONS" data-visual-intent="OUTDOOR_COMMERCIAL_EVENT"><img src="${escapeHtml(input.outdoorVisualUrl)}" alt="Commercial event projection application context"><div class="saw-split-copy"><p class="saw-kicker">Commercial application</p><h2>Commercial and event environment planning</h2><p>${escapeHtml(useCases[2] ?? planning[2] ?? extracted.intro)}</p><ul>${planning.slice(2, 6).map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul></div></section>`,
    indoorSection,
    `<section class="saw-section"><div class="saw-wrap saw-guide"><p class="saw-kicker">Specification and buyer review</p><h2>Specification and planning questions</h2><div class="saw-facts">${faq.slice(0, 4).map((question) => `<article><p>${escapeHtml(question)}</p></article>`).join("")}</div><h2>FAQ</h2>${faq.slice(0, 6).map((question) => `<p>${escapeHtml(question)}</p>`).join("")}</div></section>`,
    `<section class="saw-cta" data-reference-section="CTA"><div class="saw-wrap"><h2>Request a project-fit review</h2><p>${escapeHtml(extracted.ctaSentence)}</p><div class="saw-actions"><a class="saw-button" href="/contact-us-projection-enclosure/">Request a quote</a><a class="saw-button alt" href="${escapeHtml(input.canonicalProductHref)}">Review product authority</a></div></div></section>`,
    `</main>`,
  ].join("");

  const presented = applyProjectorEnclosurePresentationAuthority(body);
  return {
    ...input.artifact,
    contentHtml: presented.contentHtml,
  };
}