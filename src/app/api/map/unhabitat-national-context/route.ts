import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import {
  INDICATOR_PROPORTION_URBAN_SLUMS,
  INDICATOR_TOTAL_SLUM_POPULATION,
  UN_HABITAT_HDX_SOURCE,
} from "@/lib/hdxUnHabitatImportConstants";
import { matchHdxCountryToGeoName } from "@/lib/hdxGeoCountryMatch";
import { prisma } from "@/lib/prisma";
import type { UnHabitatMapCountryEntry } from "@/types/unhabitatMap";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof prisma.contextualIndicator.findMany>>[0];

function latestByCountryName(rows: Row[]) {
  const m = new Map<string, Row>();
  for (const r of rows) {
    const ex = m.get(r.countryName);
    if (!ex || r.year > ex.year) m.set(r.countryName, r);
  }
  return m;
}

/**
 * Returns UN-Habitat / HDX national context keyed by world GeoJSON `properties.name` for choropleth + tooltips.
 * Does not create or alter settlement records.
 */
export async function GET() {
  const geoPath = path.join(process.cwd(), "public", "geo", "countries.geo.json");
  const raw = await readFile(geoPath, "utf-8");
  const fc = JSON.parse(raw) as GeoJSON.FeatureCollection;
  const geoNames = fc.features
    .map((f) => (f.properties as { name?: string } | null)?.name)
    .filter((n): n is string => Boolean(n));

  const [propAll, totAll] = await Promise.all([
    prisma.contextualIndicator.findMany({
      where: { source: UN_HABITAT_HDX_SOURCE, indicatorName: INDICATOR_PROPORTION_URBAN_SLUMS },
    }),
    prisma.contextualIndicator.findMany({
      where: { source: UN_HABITAT_HDX_SOURCE, indicatorName: INDICATOR_TOTAL_SLUM_POPULATION },
    }),
  ]);

  const latestProp = latestByCountryName(propAll);
  const latestTot = latestByCountryName(totAll);

  const byGeoName: Record<string, UnHabitatMapCountryEntry> = {};
  let maxPercent = 0;

  for (const [countryName, pRow] of latestProp) {
    const geo = matchHdxCountryToGeoName(countryName, geoNames);
    if (!geo) continue;
    const tRow = latestTot.get(countryName) ?? null;
    const rawPct = parseFloat(pRow.indicatorValue);
    const pct = Number.isFinite(rawPct) ? rawPct : null;
    if (pct !== null) {
      maxPercent = Math.max(maxPercent, pct);
    }
    const rawTot = tRow ? parseFloat(tRow.indicatorValue) : NaN;
    byGeoName[geo] = {
      displayCountry: countryName,
      percentUrbanSlums: pct,
      yearPercent: pRow.year,
      totalSlumPopulation: tRow && Number.isFinite(rawTot) ? rawTot : null,
      totalUnit: tRow?.unit ?? null,
      yearTotal: tRow?.year ?? null,
    };
  }

  return NextResponse.json({
    source: UN_HABITAT_HDX_SOURCE,
    maxPercent: maxPercent > 0 ? maxPercent : 1,
    byGeoName,
  });
}
