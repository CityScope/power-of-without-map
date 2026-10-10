import { describe, expect, it } from "vitest";
import {
  applyFilters,
  completenessHistogram,
  DEFAULT_FILTERS,
  dimensionCoverage,
  finiteScore,
  findNationalContext,
  missingIndicatorFrequency,
  overviewOf,
  parseMissingVariables,
  scoreHistogram,
  summarize,
  type NationalContextIndicator,
  type SettlementObservation,
} from "@/lib/analyticsObservatory";

function row(partial: Partial<SettlementObservation> & Pick<SettlementObservation, "id">): SettlementObservation {
  return {
    name: partial.id,
    country: "Colombia",
    city: null,
    atlasReference: false,
    verificationStatus: "submitted",
    finalScore: null,
    architecture: null,
    populace: null,
    site: null,
    infrastructure: null,
    physicalNature: null,
    compactness: null,
    economy: null,
    qualityOfLife: null,
    demography: null,
    completeness: null,
    confidence: null,
    uncertainty: null,
    sourceReliability: null,
    missingVariables: null,
    ...partial,
  };
}

describe("finite scores", () => {
  it("keeps zero and drops null, undefined, and non-finite values", () => {
    expect(finiteScore(0)).toBe(0);
    expect(finiteScore(null)).toBeNull();
    expect(finiteScore(undefined)).toBeNull();
    expect(finiteScore(Number.NaN)).toBeNull();
  });

  it("does not treat a missing headline score as zero in the distribution or the average", () => {
    const rows = [
      row({ id: "a", finalScore: 0 }),
      row({ id: "b", finalScore: null }),
      row({ id: "c", finalScore: 0.5 }),
    ];
    const summary = summarize(rows.flatMap((item) => (finiteScore(item.finalScore) === null ? [] : [item.finalScore as number])));
    expect(summary).toEqual({ n: 2, mean: 0.25, median: 0.25, min: 0, max: 0.5 });
    expect(scoreHistogram([0, 0.5])[0]).toMatchObject({ range: "0.0–0.2", count: 1 });
    expect(scoreHistogram([0, 0.5]).reduce((total, bin) => total + bin.count, 0)).toBe(2);
  });

  it("counts a known completeness of zero and ignores a missing completeness", () => {
    const rows = [
      row({ id: "a", completeness: 0 }),
      row({ id: "b", completeness: null }),
      row({ id: "c", completeness: 1, atlasReference: true }),
    ];
    const community = rows.filter((item) => !item.atlasReference);
    const values = community.flatMap((item) => (finiteScore(item.completeness) === null ? [] : [item.completeness as number]));
    expect(values).toEqual([0]);
    expect(completenessHistogram(values)[0]).toMatchObject({ range: "0–25%", count: 1 });
  });
});

describe("observatory scope", () => {
  const rows = [
    row({ id: "atlas", atlasReference: true, country: "Kenya", verificationStatus: "submitted", finalScore: null, missingVariables: ["water"] }),
    row({
      id: "community",
      country: "Colombia",
      verificationStatus: "draft",
      finalScore: 0.4,
      architecture: 0.4,
      completeness: 0.2,
      missingVariables: ["water", "sanitation"],
    }),
    row({ id: "blank", country: null, verificationStatus: "submitted", finalScore: null, missingVariables: null }),
  ];

  it("filters record type, status, country, score, and completeness without mixing populations", () => {
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, recordType: "atlas" }).map((item) => item.id)).toEqual(["atlas"]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, status: "draft" }).map((item) => item.id)).toEqual(["community"]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, country: "Unknown" }).map((item) => item.id)).toEqual(["blank"]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, scoreAvailability: "scored" }).map((item) => item.id)).toEqual(["community"]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, completeness: "0-25" }).map((item) => item.id)).toEqual(["community"]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, completeness: "unknown" }).map((item) => item.id)).toEqual(["atlas", "blank"]);
  });

  it("counts missing indicators only among community records that stored a missing list", () => {
    const result = missingIndicatorFrequency(rows);
    expect(result.denominator).toBe(1);
    expect(result.items.map((item) => item.key).sort()).toEqual(["sanitation", "water"]);
    expect(result.items[0]?.percent).toBe(100);
    expect(result.items.find((item) => item.key === "water")?.label).toContain("water");
  });

  it("separates atlas references from scored settlements in the overview", () => {
    const overview = overviewOf(rows);
    expect(overview.total).toBe(3);
    expect(overview.atlas).toBe(1);
    expect(overview.community).toBe(2);
    expect(overview.scored).toBe(1);
    expect(overview.countries).toBe(2);
    expect(overview.completeness?.n).toBe(1);
    expect(overview.completeness?.mean).toBe(0.2);
  });

  it("reports dimension coverage without turning a missing dimension into zero", () => {
    expect(dimensionCoverage(rows, (item) => item.architecture)).toEqual({ available: 1, missing: 2, total: 3 });
  });
});

describe("national context matching", () => {
  const nationals: NationalContextIndicator[] = [
    {
      country: "Colombia",
      countryCode: "COL",
      region: "Americas",
      subRegion: "South America",
      source: "UN-Habitat / HDX",
      proportion: { value: 20, year: 2020, sourceUrl: "https://example.test" },
      population: null,
    },
  ];

  it("matches a settlement country without inventing a national value", () => {
    expect(findNationalContext("Colombia", nationals)?.proportion?.value).toBe(20);
    expect(findNationalContext("  colombia  ", nationals)?.country).toBe("Colombia");
    expect(findNationalContext(null, nationals)).toBeNull();
    expect(findNationalContext("Kenya", nationals)).toBeNull();
  });
});

describe("missing variable parsing", () => {
  it("returns null for absent or invalid payloads and keeps an empty list", () => {
    expect(parseMissingVariables(null)).toBeNull();
    expect(parseMissingVariables("")).toBeNull();
    expect(parseMissingVariables("{")).toBeNull();
    expect(parseMissingVariables("[]")).toEqual([]);
    expect(parseMissingVariables('["water", 1]')).toEqual(["water"]);
  });
});
