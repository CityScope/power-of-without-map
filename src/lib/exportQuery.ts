/**
 * Query string and selection summary for the export page.
 * This mirrors the existing exporter filters. It does not change them.
 * A missing score stays missing and is not treated as zero.
 */

export type ExportFilterInput = {
  country: string;
  minScore: string;
  maxScore: string;
  minCompleteness: string;
};

export const DEFAULT_EXPORT_FILTERS: ExportFilterInput = {
  country: "",
  minScore: "0",
  maxScore: "1",
  minCompleteness: "0",
};

export type ExportCountRow = {
  country: string | null;
  finalScore: number | null;
  completeness: number | null;
};

/** Empty numeric fields use the page defaults, so a cleared box is not sent as an empty parameter. */
export function activeExportFilters(filters: ExportFilterInput): ExportFilterInput {
  return {
    country: filters.country,
    minScore: filters.minScore.trim() === "" ? "0" : filters.minScore,
    maxScore: filters.maxScore.trim() === "" ? "1" : filters.maxScore,
    minCompleteness: filters.minCompleteness.trim() === "" ? "0" : filters.minCompleteness,
  };
}

export function buildExportSearch(filters: ExportFilterInput) {
  const active = activeExportFilters(filters);
  const params = new URLSearchParams();
  params.set("country", active.country);
  params.set("minScore", active.minScore);
  params.set("maxScore", active.maxScore);
  params.set("minCompleteness", active.minCompleteness);
  return `?${params.toString()}`;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Same retention rules as `applySettlementFilters`:
 * a missing score or completeness does not fail a numeric threshold.
 */
export function settlementMatchesExportFilters(row: ExportCountRow, filters: ExportFilterInput) {
  if (filters.country && row.country !== filters.country) return false;
  const score = row.finalScore;
  if (filters.minScore !== "" && score !== null && score < Number(filters.minScore)) return false;
  if (filters.maxScore !== "" && score !== null && score > Number(filters.maxScore)) return false;
  const completeness = row.completeness;
  if (filters.minCompleteness !== "" && completeness !== null && completeness < Number(filters.minCompleteness)) return false;
  return true;
}

export function readExportRows(payload: unknown): ExportCountRow[] | null {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { settlements?: unknown }).settlements)) return null;
  return (payload as { settlements: unknown[] }).settlements.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const record = row as { country?: unknown; finalScore?: unknown; completeness?: unknown };
    const country = typeof record.country === "string" ? record.country : null;
    return [{ country, finalScore: finiteOrNull(record.finalScore), completeness: finiteOrNull(record.completeness) }];
  });
}

export function countryNames(rows: ExportCountRow[]) {
  return Array.from(new Set(rows.flatMap((row) => (row.country && row.country.trim() ? [row.country] : [])))).sort((a, b) =>
    a.localeCompare(b),
  );
}
