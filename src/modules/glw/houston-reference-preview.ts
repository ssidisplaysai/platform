import type { LocalPageThemingBundle } from "@/modules/foundation/local-context-page-theming-repository";
import type { MarketProductMatchBundle } from "@/modules/foundation/local-market-product-match-repository";

export const HOUSTON_TARGET_ID = "target-campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-texas-cities-tx-houston" as const;
export const HOUSTON_CANONICAL_PATH = "fan-cooled-projector-enclosures/texas/houston" as const;
export const HOUSTON_PREVIEW_ID = "houston-reference-preview-v1" as const;
export const HOUSTON_BUNDLE_ID = "local-theming-houston-southeast-texas-v1" as const;
export const HOUSTON_MARKET_BUNDLE_ID = "market-match-houston-southeast-texas-v1" as const;
export const HOUSTON_PRODUCT_ID = "prod-ssi-fan-cooled-projector-enclosures" as const;
export const HOUSTON_PRODUCT_MEDIA_ID = 10757 as const;
export const HOUSTON_PRODUCT_MEDIA_HASH = "685495793be84b3a9d1a7e902087d63ae7a636e2042e6c0d592f5ba83e767078" as const;
export const HOUSTON_PRODUCT_MEDIA_URL = "https://projectorenclosure.com/wp-content/uploads/2024/03/Integrator-scaled-1.webp" as const;
export const HOUSTON_RENDERER_VERSION = "houston-reference-preview-v1.1" as const;

export type HoustonPreviewNarrative = {
  eyebrow: string;
  heroHeading: string;
  heroBody: string;
  productHeading: string;
  productBody: string;
  inUseHeading: string;
  inUseBody: string;
  applicationHeading: string;
  applicationBody: string;
  planningHeading: string;
  planningBody: string;
  suitabilityHeading: string;
  suitabilityBody: string;
  resourceHeading: string;
};

export const HOUSTON_NARRATIVE: HoustonPreviewNarrative = {
  eyebrow: "ProjectorEnclosure x Houston / Southeast Texas",
  heroHeading: "Protected projection for Houston's indoor and covered commercial spaces.",
  heroBody: "Fan-cooled projector enclosures support airflow, equipment protection, and service access where the installation remains indoor, covered, or otherwise mild. Houston heat, humidity, rainfall, and storm exposure make exact site review essential.",
  productHeading: "Fan-cooled protection where airflow and access matter.",
  productBody: "The approved Integrator authority supports commercial AV, event, and projection systems in controlled or covered settings. Projector, lens, mounting, duty cycle, airflow, and exposure still determine fit.",
  inUseHeading: "A credible covered convention and hospitality environment.",
  inUseBody: "This product-grounded concept shows a serviceable enclosure in a generic Houston-relevant commercial AV setting. It is not a Houston property, customer, office, or completed SSI installation.",
  applicationHeading: "Commercial AV for flexible convention and event programs.",
  applicationBody: "Houston's documented convention, theater, hotel, and event ecosystem supports commercial AV as the primary page application. Projection mapping remains a bounded supporting use, not the default market conclusion.",
  planningHeading: "Gulf Coast conditions change the enclosure conversation.",
  planningBody: "Official Houston climate evidence documents high summer temperatures and substantial rainfall. Indoor and covered applications may fit fan-cooled protection; exposed, humid, harsh, or permanent outdoor systems should be evaluated against climate-controlled or IP-rated authority.",
  suitabilityHeading: "Know when fan cooling is not enough.",
  suitabilityBody: "For rain exposure, high humidity, extreme temperature changes, or permanent outdoor operation, review the approved Climate Controlled Projector Enclosures resource and request project-specific sizing guidance.",
  resourceHeading: "Houston and Southeast Texas planning resources",
};

export type HoustonReferencePreview = {
  bundle: LocalPageThemingBundle;
  market: MarketProductMatchBundle;
  narrative: HoustonPreviewNarrative;
  comparison: {
    dallasPrimaryApplication: string;
    houstonPrimaryApplication: string;
    primaryApplicationDifferent: boolean;
    themeDifferent: boolean;
    marketEvidenceDifferent: boolean;
    mediaDifferent: boolean;
    linkGraphDifferent: boolean;
  };
};
