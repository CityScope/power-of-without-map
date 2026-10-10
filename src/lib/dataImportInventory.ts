/**
 * Counts for the Data Sources page, derived from the existing analytics payload.
 * A missing payload stays missing. An empty list is a real zero.
 */

export type ImportInventory = {
  atlasSettlements: number;
  communitySettlements: number;
  nationalCountries: number;
  latestObservationYearMin: number | null;
  latestObservationYearMax: number | null;
  settlementCountries: number;
  settlementsWithoutCountry: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function finiteYear(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function summarizeImportInventory(payload: unknown): ImportInventory | null {
  if (!isRecord(payload) || !Array.isArray(payload.settlements) || !Array.isArray(payload.nationalIndicators)) return null;

  let atlasSettlements = 0;
  let communitySettlements = 0;
  let settlementsWithoutCountry = 0;
  const settlementCountries = new Set<string>();

  for (const row of payload.settlements) {
    if (!isRecord(row)) continue;
    if (row.atlasReference === true) atlasSettlements += 1;
    else communitySettlements += 1;
    const country = typeof row.country === "string" ? row.country.trim() : "";
    if (country) settlementCountries.add(country);
    else settlementsWithoutCountry += 1;
  }

  const years: number[] = [];
  let nationalCountries = 0;
  for (const row of payload.nationalIndicators) {
    if (!isRecord(row) || typeof row.country !== "string" || !row.country.trim()) continue;
    nationalCountries += 1;
    if (isRecord(row.proportion)) {
      const year = finiteYear(row.proportion.year);
      if (year !== null) years.push(year);
    }
    if (isRecord(row.population)) {
      const year = finiteYear(row.population.year);
      if (year !== null) years.push(year);
    }
  }

  return {
    atlasSettlements,
    communitySettlements,
    nationalCountries,
    latestObservationYearMin: years.length ? Math.min(...years) : null,
    latestObservationYearMax: years.length ? Math.max(...years) : null,
    settlementCountries: settlementCountries.size,
    settlementsWithoutCountry,
  };
}
