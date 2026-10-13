import { evaluateLocalizationContamination } from "../localization-contamination-gate";

const references = [
  { label: "Dallas", authority: "REFERENCE_TARGET:DALLAS" },
  { label: "Houston", authority: "REFERENCE_TARGET:HOUSTON" },
  { label: "Austin", authority: "CAMPAIGN_TARGET:AUSTIN" },
  { label: "Plano", authority: "CAMPAIGN_TARGET:PLANO" },
];

describe("LOCALIZATION_CONTAMINATION_GATE", () => {
  test.each([
    ["Dallas", "Fan Cooled Projector Enclosures in Dallas", "Dallas, Texas"],
    ["Houston", "Fan Cooled Projector Enclosures in Houston", "Houston, Texas"],
  ])("accepts expected %s owner-visible geography", (city, title, eyebrow) => {
    const result = evaluateLocalizationContamination({ expectedLocation: { city, state: "Texas" }, forbiddenReferenceLocations: references, surfaces: [{ source: "EYEBROW", text: eyebrow }, { source: "TITLE", text: title }] });
    expect(result.state).toBe("PASS");
    expect(result.forbiddenOccurrences).toEqual([]);
  });

  test("fails San Antonio when the Dallas reference residue reaches an owner-visible eyebrow", () => {
    const result = evaluateLocalizationContamination({ expectedLocation: { city: "San Antonio", state: "Texas" }, forbiddenReferenceLocations: references, surfaces: [{ source: "EYEBROW", text: "Dallas, Texas" }, { source: "TITLE", text: "Fan Cooled Projector Enclosures in San Antonio" }] });
    expect(result.state).toBe("FAIL");
    expect(result.forbiddenOccurrences).toEqual([{ token: "Dallas", source: "EYEBROW", classification: "FORBIDDEN_REFERENCE_LOCATION", authority: "REFERENCE_TARGET:DALLAS" }]);
  });

  test("allows an explicit geographic comparison backed by context authority", () => {
    const result = evaluateLocalizationContamination({ expectedLocation: { city: "San Antonio", state: "Texas" }, allowedContextLocations: [{ label: "Houston", authority: "LOCAL_CONTEXT:REGIONAL_COMPARISON" }], forbiddenReferenceLocations: references, surfaces: [{ source: "BODY", text: "Unlike Houston coastal conditions, San Antonio planning emphasizes its own verified context." }] });
    expect(result.state).toBe("PASS");
    expect(result.occurrences).toEqual(expect.arrayContaining([expect.objectContaining({ token: "Houston", classification: "ALLOWED_CONTEXT_LOCATION" })]));
  });
});