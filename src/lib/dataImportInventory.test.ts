import { describe, expect, it } from "vitest";
import { summarizeImportInventory } from "@/lib/dataImportInventory";

describe("summarizeImportInventory", () => {
  it("returns null when the payload is missing or incomplete", () => {
    expect(summarizeImportInventory(null)).toBeNull();
    expect(summarizeImportInventory({})).toBeNull();
    expect(summarizeImportInventory({ settlements: [] })).toBeNull();
  });

  it("counts empty lists as zero and keeps blank countries separate", () => {
    const summary = summarizeImportInventory({
      settlements: [
        { atlasReference: true, country: "Mexico" },
        { atlasReference: true, country: "  " },
        { atlasReference: false, country: null },
      ],
      nationalIndicators: [
        { country: "Mexico", proportion: { year: 2022 }, population: null },
        { country: "Kenya", proportion: null, population: { year: 2018 } },
        { country: " ", proportion: { year: 2020 }, population: null },
      ],
    });
    expect(summary).toEqual({
      atlasSettlements: 2,
      communitySettlements: 1,
      nationalCountries: 2,
      latestObservationYearMin: 2018,
      latestObservationYearMax: 2022,
      settlementCountries: 1,
      settlementsWithoutCountry: 2,
    });
  });
});
