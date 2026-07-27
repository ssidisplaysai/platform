import { GMP_PUBLISHING_RENDERER_VERSION, stablePublishingFingerprint, type GmpApprovedRevisionSet, type GmpPublishingDestinationType } from "./publishing-models";

export type GmpRenderedContent = {
  rendererVersion: string;
  destinationType: GmpPublishingDestinationType;
  renderingPolicyVersion: string;
  inputFingerprint: string;
  outputFingerprint: string;
  title: string;
  html: string;
  excerpt: string;
};

function sanitizeHtml(value: string): string {
  return value.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function renderPublishingContent(input: {
  approvedRevisionSet: GmpApprovedRevisionSet;
  destinationType: GmpPublishingDestinationType;
  renderingPolicyVersion: string;
}): GmpRenderedContent {
  const ordered = [...input.approvedRevisionSet.sections].sort((left, right) => left.position - right.position);
  const title = ordered[0]?.heading ?? "Untitled";

  const htmlBlocks = ordered.map((section) => {
    const heading = section.heading?.trim() ? `<h2>${section.heading}</h2>` : "";
    const body = section.bodyContent?.trim() ? `<p>${section.bodyContent}</p>` : "";
    const cta = section.ctaContent && Object.keys(section.ctaContent).length > 0
      ? `<aside data-cta='true'>${JSON.stringify(section.ctaContent)}</aside>`
      : "";
    return `<section data-section-key='${section.pageSectionStableKey}'>${heading}${body}${cta}</section>`;
  });

  const html = sanitizeHtml(htmlBlocks.join("\n"));
  const excerpt = stripHtml(html).slice(0, 240);
  const outputFingerprint = stablePublishingFingerprint({ html, destination: input.destinationType, renderingPolicyVersion: input.renderingPolicyVersion });

  return {
    rendererVersion: GMP_PUBLISHING_RENDERER_VERSION,
    destinationType: input.destinationType,
    renderingPolicyVersion: input.renderingPolicyVersion,
    inputFingerprint: input.approvedRevisionSet.sourceFingerprint,
    outputFingerprint,
    title,
    html,
    excerpt,
  };
}
