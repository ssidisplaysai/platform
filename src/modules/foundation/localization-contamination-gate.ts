export const LOCALIZATION_CONTAMINATION_GATE = "LOCALIZATION_CONTAMINATION_GATE" as const;

export type LocalizationLocationAuthority = {
  label: string;
  classification: "EXPECTED_LOCATION" | "ALLOWED_CONTEXT_LOCATION" | "FORBIDDEN_REFERENCE_LOCATION";
  authority: string;
};

export type LocalizationVisibleSurface = {
  source: "EYEBROW" | "TITLE" | "HEADING" | "BODY" | "CTA" | "ALT_TEXT" | "METADATA" | "COMPOSITION_LABEL";
  text: string | null | undefined;
};

export type LocalizationLocationOccurrence = {
  token: string;
  source: LocalizationVisibleSurface["source"];
  classification: LocalizationLocationAuthority["classification"];
  authority: string;
};

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function containsToken(text: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "iu").test(text);
}

export function evaluateLocalizationContamination(input: {
  expectedLocation: { city: string; state: string };
  allowedContextLocations?: readonly { label: string; authority: string }[];
  forbiddenReferenceLocations?: readonly { label: string; authority: string }[];
  surfaces: readonly LocalizationVisibleSurface[];
}): {
  contract: typeof LOCALIZATION_CONTAMINATION_GATE;
  state: "PASS" | "FAIL";
  occurrences: readonly LocalizationLocationOccurrence[];
  forbiddenOccurrences: readonly LocalizationLocationOccurrence[];
} {
  const expected = [input.expectedLocation.city, input.expectedLocation.state]
    .filter((label) => label.trim())
    .map((label) => ({ label, classification: "EXPECTED_LOCATION" as const, authority: "TARGET_IDENTITY" }));
  const allowed = (input.allowedContextLocations ?? []).map((location) => ({ ...location, classification: "ALLOWED_CONTEXT_LOCATION" as const }));
  const forbidden = (input.forbiddenReferenceLocations ?? []).map((location) => ({ ...location, classification: "FORBIDDEN_REFERENCE_LOCATION" as const }));
  const authorities = [...expected, ...allowed, ...forbidden].filter((location, index, all) => {
    const key = normalized(location.label);
    return key && all.findIndex((candidate) => normalized(candidate.label) === key) === index;
  });
  const occurrences: LocalizationLocationOccurrence[] = [];
  for (const surface of input.surfaces) {
    const text = surface.text?.trim();
    if (!text) continue;
    for (const location of authorities) {
      if (containsToken(text, normalized(location.label))) occurrences.push({ token: location.label, source: surface.source, classification: location.classification, authority: location.authority });
    }
  }
  const forbiddenOccurrences = occurrences.filter((occurrence) => occurrence.classification === "FORBIDDEN_REFERENCE_LOCATION");
  return { contract: LOCALIZATION_CONTAMINATION_GATE, state: forbiddenOccurrences.length ? "FAIL" : "PASS", occurrences, forbiddenOccurrences };
}