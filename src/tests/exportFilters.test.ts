import { describe, expect, it } from "vitest";
import { applySettlementFilters } from "../lib/exportFilters";

describe("export filters", () => {
  const settlements = [
    { country: "Kenya", calculatedScores: [{ finalInformalityScore: 0.7, completenessScore: 0.8 }] },
    { country: "India", calculatedScores: [{ finalInformalityScore: 0.4, completenessScore: 0.6 }] },
    { country: "Kenya", calculatedScores: [{ finalInformalityScore: 0.2, completenessScore: 0.95 }] },
  ];

  it("filters by country and score range", () => {
    const out = applySettlementFilters(settlements, {
      country: "Kenya",
      minScore: "0.3",
      maxScore: "0.9",
      minCompleteness: "0",
    });
    expect(out).toHaveLength(1);
    expect(out[0].country).toBe("Kenya");
  });

  it("keeps a missing score and drops a stored zero below the minimum", () => {
    const out = applySettlementFilters(
      [
        { country: "Mexico", calculatedScores: [{}] },
        { country: "Mexico", calculatedScores: [{ finalInformalityScore: 0, completenessScore: 0.4 }] },
        { country: "Mexico", calculatedScores: [{ finalInformalityScore: 0.6, completenessScore: 0.4 }] },
      ],
      { country: "Mexico", minScore: "0.5", maxScore: "1", minCompleteness: null },
    );
    expect(out.map((row) => row.calculatedScores[0]?.finalInformalityScore)).toEqual([undefined, 0.6]);
  });

  it("filters by completeness threshold", () => {
    const out = applySettlementFilters(settlements, {
      country: null,
      minScore: "0",
      maxScore: "1",
      minCompleteness: "0.9",
    });
    expect(out).toHaveLength(1);
    expect(out[0].country).toBe("Kenya");
  });
});
