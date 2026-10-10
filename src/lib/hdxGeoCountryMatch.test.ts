import { describe, expect, it } from "vitest";
import { matchHdxCountryToGeoName } from "./hdxGeoCountryMatch";

const GEO = [
  "United States of America",
  "Ivory Coast",
  "Russian Federation",
  "Macedonia",
  "United Republic of Tanzania",
  "South Korea",
];

describe("matchHdxCountryToGeoName", () => {
  it("maps common UN/HDX aliases to johan GeoJSON names", () => {
    expect(matchHdxCountryToGeoName("United States", GEO)).toBe("United States of America");
    expect(matchHdxCountryToGeoName("Côte d'Ivoire", GEO)).toBe("Ivory Coast");
    expect(matchHdxCountryToGeoName("Russian Federation", GEO)).toBe("Russian Federation");
    expect(matchHdxCountryToGeoName("North Macedonia", GEO)).toBe("Macedonia");
  });

  it("returns exact geo label when strings match", () => {
    expect(matchHdxCountryToGeoName("United Republic of Tanzania", GEO)).toBe("United Republic of Tanzania");
  });
});
