import { describe, expect, it } from "vitest";
import { applySettlementFilters } from "@/lib/exportFilters";
import {
  buildExportSearch,
  countryNames,
  DEFAULT_EXPORT_FILTERS,
  readExportRows,
  settlementMatchesExportFilters,
  type ExportCountRow,
} from "@/lib/exportQuery";

describe("export query", () => {
  it("builds the same default parameters the export page already sends", () => {
    expect(buildExportSearch(DEFAULT_EXPORT_FILTERS)).toBe("?country=&minScore=0&maxScore=1&minCompleteness=0");
  });

  it("keeps a country name exact, including spaces", () => {
    expect(buildExportSearch({ ...DEFAULT_EXPORT_FILTERS, country: "South Africa" })).toBe(
      "?country=South+Africa&minScore=0&maxScore=1&minCompleteness=0",
    );
  });

  it("matches the exporter when a score is missing, zero, or below the minimum", () => {
    const stored = [
      { country: "Mexico", calculatedScores: [{}] },
      { country: "Mexico", calculatedScores: [{ finalInformalityScore: 0, completenessScore: 0 }] },
      { country: "Mexico", calculatedScores: [{ finalInformalityScore: 0.8, completenessScore: null }] },
      { country: "Kenya", calculatedScores: [{ finalInformalityScore: 0.9, completenessScore: 1 }] },
    ];
    const filters = { country: "Mexico", minScore: "0.5", maxScore: "1", minCompleteness: "0.5" };
    const fromExporter = applySettlementFilters(stored, filters);
    const rows: ExportCountRow[] = stored.map((row) => ({
      country: row.country,
      finalScore: row.calculatedScores[0]?.finalInformalityScore ?? null,
      completeness: row.calculatedScores[0]?.completenessScore ?? null,
    }));
    const fromPage = rows.filter((row) => settlementMatchesExportFilters(row, filters));
    expect(fromPage.map((row) => row.finalScore)).toEqual(fromExporter.map((row) => row.calculatedScores[0]?.finalInformalityScore ?? null));
    expect(fromPage.map((row) => row.finalScore)).toEqual([null, 0.8]);
  });

  it("reads settlement rows without turning a missing score into zero", () => {
    const rows = readExportRows({
      settlements: [
        { country: "Mexico", finalScore: null, completeness: 0 },
        { country: " ", finalScore: 0.2, completeness: null },
        { country: null, finalScore: undefined, completeness: undefined },
      ],
    });
    expect(rows).toEqual([
      { country: "Mexico", finalScore: null, completeness: 0 },
      { country: " ", finalScore: 0.2, completeness: null },
      { country: null, finalScore: null, completeness: null },
    ]);
    expect(countryNames(rows ?? [])).toEqual(["Mexico"]);
  });
});
