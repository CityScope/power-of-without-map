import { prisma } from "@/lib/prisma";
import {
  INDICATOR_PROPORTION_URBAN_SLUMS,
  INDICATOR_TOTAL_SLUM_POPULATION,
  UN_HABITAT_HDX_SOURCE,
} from "@/lib/hdxUnHabitatImportConstants";

function latestByCountry<T extends { countryName: string; year: number; indicatorValue: string }>(rows: T[]) {
  const byCountry = new Map<string, T>();
  for (const r of rows) {
    const key = r.countryName;
    const prev = byCountry.get(key);
    if (!prev || r.year > prev.year) byCountry.set(key, r);
  }
  return Array.from(byCountry.values());
}

function parseNumericValue(v: string): number | null {
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

export async function getContextualHdxTopCountries() {
  const [propAll, totAll] = await Promise.all([
    prisma.contextualIndicator.findMany({
      where: { source: UN_HABITAT_HDX_SOURCE, indicatorName: INDICATOR_PROPORTION_URBAN_SLUMS },
    }),
    prisma.contextualIndicator.findMany({
      where: { source: UN_HABITAT_HDX_SOURCE, indicatorName: INDICATOR_TOTAL_SLUM_POPULATION },
    }),
  ]);
  const latestProp = latestByCountry(propAll);
  const latestTot = latestByCountry(totAll);
  const topProportion = latestProp
    .map((r) => {
      const value = parseNumericValue(r.indicatorValue);
      if (value === null) return null;
      return { country: r.countryName, year: r.year, proportionUrbanSlumsPercent: value };
    })
    .filter((r): r is { country: string; year: number; proportionUrbanSlumsPercent: number } => r !== null)
    .sort((a, b) => b.proportionUrbanSlumsPercent - a.proportionUrbanSlumsPercent)
    .slice(0, 12);
  const topTotal = latestTot
    .map((r) => {
      const value = parseNumericValue(r.indicatorValue);
      if (value === null) return null;
      return { country: r.countryName, year: r.year, totalSlumPopulation: value };
    })
    .filter((r): r is { country: string; year: number; totalSlumPopulation: number } => r !== null)
    .sort((a, b) => b.totalSlumPopulation - a.totalSlumPopulation)
    .slice(0, 12);
  return { topProportion, topTotal };
}

export type NationalContextIndicator = {
  country: string;
  countryCode: string;
  region: string;
  subRegion: string;
  source: string;
  proportion: { value: number; year: number; sourceUrl: string } | null;
  population: { value: number; year: number; sourceUrl: string } | null;
};

/** Latest UN-Habitat/HDX row per country. Missing indicator values stay null. */
export async function getNationalContextIndicators(): Promise<NationalContextIndicator[]> {
  const [propAll, totAll] = await Promise.all([
    prisma.contextualIndicator.findMany({
      where: { source: UN_HABITAT_HDX_SOURCE, indicatorName: INDICATOR_PROPORTION_URBAN_SLUMS },
    }),
    prisma.contextualIndicator.findMany({
      where: { source: UN_HABITAT_HDX_SOURCE, indicatorName: INDICATOR_TOTAL_SLUM_POPULATION },
    }),
  ]);
  const byCountry = new Map<string, NationalContextIndicator>();
  for (const row of latestByCountry(propAll)) {
    const value = parseNumericValue(row.indicatorValue);
    byCountry.set(row.countryName, {
      country: row.countryName,
      countryCode: row.countryCode,
      region: row.region,
      subRegion: row.subRegion,
      source: row.source,
      proportion: value === null ? null : { value, year: row.year, sourceUrl: row.sourceUrl },
      population: null,
    });
  }
  for (const row of latestByCountry(totAll)) {
    const value = parseNumericValue(row.indicatorValue);
    const current = byCountry.get(row.countryName) ?? {
      country: row.countryName,
      countryCode: row.countryCode,
      region: row.region,
      subRegion: row.subRegion,
      source: row.source,
      proportion: null,
      population: null,
    };
    current.population = value === null ? null : { value, year: row.year, sourceUrl: row.sourceUrl };
    if (!current.region) current.region = row.region;
    if (!current.subRegion) current.subRegion = row.subRegion;
    byCountry.set(row.countryName, current);
  }
  return Array.from(byCountry.values()).sort((a, b) => a.country.localeCompare(b.country));
}
