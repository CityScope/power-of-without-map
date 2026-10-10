import { beforeEach, describe, expect, it, vi } from "vitest";
import { getContextualHdxTopCountries } from "../lib/contextualIndicatorAnalytics";
import { getLatestNationalHdxContext } from "../lib/contextualNationalContext";
import {
  mapHdxCkanRow,
  parseHdxCkanCsvString,
  pickProportionValueColumn,
  pickTotalValueColumn,
} from "../lib/hdxUnHabitatImport";
import {
  HDX_CSV_PROPORTION_URL,
  INDICATOR_PROPORTION_URBAN_SLUMS,
  UN_HABITAT_HDX_SOURCE,
} from "../lib/hdxUnHabitatImportConstants";

const proportionCsv = `Country or Territory Name,Country or Territory Name2,SDG Region,SDG Sub-Region,Proportion of urban population living in slums or informal settlements (%) (a),Data Units,Data Reference Year,Footnote
4,Testland,Region A,Sub A,12.3,PERCENT,2019,note1
4,Testland,Region A,Sub A,11.0,PERCENT,2018,note0`;

const totalCsv = `Country or Territory Name,Country or Territory Name2,SDG Region,SDG Sub-Region,Total population living in slums and informal settlements (a),Data Units,Data Reference Year,Footnote
4,Testland,Region A,Sub A,1000000,PEOPLE,2019,note1`;

vi.mock("../lib/prisma", () => {
  return {
    prisma: {
      contextualIndicator: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({}),
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      settlement: { create: vi.fn() },
    },
  };
});

import { prisma } from "../lib/prisma";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("HDX UN-Habitat CSV import mapping", () => {
  it("parses header rows and maps proportion column", () => {
    const { rows, headers } = parseHdxCkanCsvString(proportionCsv);
    expect(rows.length).toBe(2);
    const vcol = pickProportionValueColumn(headers);
    const m0 = mapHdxCkanRow(rows[0], vcol, INDICATOR_PROPORTION_URBAN_SLUMS, HDX_CSV_PROPORTION_URL);
    expect(m0?.countryName).toBe("Testland");
    expect(m0?.year).toBe(2019);
    expect(m0?.indicatorValue).toBe("12.3");
    expect(m0?.unit).toBe("PERCENT");
  });

  it("detects total value column and maps totals", () => {
    const { rows, headers } = parseHdxCkanCsvString(totalCsv);
    const vcol = pickTotalValueColumn(headers);
    expect(vcol.toLowerCase()).toContain("total");
    const m = mapHdxCkanRow(rows[0], vcol, "Total population living in slums and informal settlements", "https://example.org/t.csv");
    expect(m?.indicatorValue).toBe("1000000");
  });
});

describe("contextual latest selection", () => {
  it("picks the latest year for national context", async () => {
    vi.mocked(prisma.contextualIndicator.findMany).mockImplementation(async (args) => {
      const where = (args as { where?: { indicatorName?: string } })?.where;
      if (where?.indicatorName === INDICATOR_PROPORTION_URBAN_SLUMS) {
        return [
          {
            id: "1",
            source: UN_HABITAT_HDX_SOURCE,
            countryCode: "4",
            countryName: "Testland",
            city: null,
            region: "R",
            subRegion: "S",
            indicatorName: INDICATOR_PROPORTION_URBAN_SLUMS,
            indicatorValue: "11",
            unit: "PERCENT",
            year: 2018,
            sourceUrl: "u",
            footnote: null,
            rawJson: "{}",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "2",
            source: UN_HABITAT_HDX_SOURCE,
            countryCode: "4",
            countryName: "Testland",
            city: null,
            region: "R",
            subRegion: "S",
            indicatorName: INDICATOR_PROPORTION_URBAN_SLUMS,
            indicatorValue: "12.3",
            unit: "PERCENT",
            year: 2019,
            sourceUrl: "u",
            footnote: null,
            rawJson: "{}",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      }
      return [
        {
          id: "3",
          source: UN_HABITAT_HDX_SOURCE,
          countryCode: "4",
          countryName: "Testland",
          city: null,
          region: "R",
          subRegion: "S",
          indicatorName: "Total population living in slums and informal settlements",
          indicatorValue: "1000",
          unit: "PEOPLE",
          year: 2019,
          sourceUrl: "u2",
          footnote: null,
          rawJson: "{}",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
    });

    const ctx = await getLatestNationalHdxContext("testland");
    expect(ctx.matched).toBe(true);
    expect(ctx.proportion?.year).toBe(2019);
    expect(ctx.proportion?.indicatorValue).toBe("12.3");
    expect(ctx.total?.year).toBe(2019);
  });
});

describe("importer does not create settlements", () => {
  it("never calls prisma.settlement.create from contextual indicator helpers", async () => {
    await getContextualHdxTopCountries();
    expect(prisma.settlement.create).not.toHaveBeenCalled();
  });
});
