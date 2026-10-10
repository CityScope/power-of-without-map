import { prisma } from "@/lib/prisma";
import {
  INDICATOR_PROPORTION_URBAN_SLUMS,
  INDICATOR_TOTAL_SLUM_POPULATION,
  UN_HABITAT_HDX_SOURCE,
} from "@/lib/hdxUnHabitatImportConstants";

function normalizeName(s: string) {
  return s.trim().toLowerCase();
}

/**
 * Latest national UN-Habitat / HDX rows for a settlement `country` string (e.g. "Colombia"),
 * case-insensitive match on `countryName`.
 */
export async function getLatestNationalHdxContext(country: string | null | undefined) {
  if (!country?.trim()) {
    return { proportion: null as null, total: null as null, matched: false as const };
  }
  const want = normalizeName(country);
  const [propRows, totRows] = await Promise.all([
    prisma.contextualIndicator.findMany({
      where: { source: UN_HABITAT_HDX_SOURCE, indicatorName: INDICATOR_PROPORTION_URBAN_SLUMS },
    }),
    prisma.contextualIndicator.findMany({
      where: { source: UN_HABITAT_HDX_SOURCE, indicatorName: INDICATOR_TOTAL_SLUM_POPULATION },
    }),
  ]);
  const pickLatest = (rows: typeof propRows) => {
    const forCountry = rows.filter((r) => normalizeName(r.countryName) === want);
    if (!forCountry.length) return null;
    forCountry.sort((a, b) => b.year - a.year);
    return forCountry[0] ?? null;
  };
  const proportion = pickLatest(propRows);
  const total = pickLatest(totRows);
  return {
    matched: Boolean(proportion || total),
    proportion: proportion
      ? {
          indicatorValue: proportion.indicatorValue,
          unit: proportion.unit,
          year: proportion.year,
          source: proportion.source,
          sourceUrl: proportion.sourceUrl,
        }
      : null,
    total: total
      ? {
          indicatorValue: total.indicatorValue,
          unit: total.unit,
          year: total.year,
          source: total.source,
          sourceUrl: total.sourceUrl,
        }
      : null,
  };
}
