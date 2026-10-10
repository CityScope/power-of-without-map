import { QUESTIONNAIRE_QUESTIONS } from "@/lib/questionnaireSchema";

/**
 * Presentation statistics for the Informality Observatory.
 * Missing scores stay missing. A stored zero remains a zero.
 * This module does not recompute informality scores.
 */

export type ScoreValue = number | null;

export type SettlementObservation = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  atlasReference: boolean;
  verificationStatus: string;
  finalScore: ScoreValue;
  architecture: ScoreValue;
  populace: ScoreValue;
  site: ScoreValue;
  infrastructure: ScoreValue;
  physicalNature: ScoreValue;
  compactness: ScoreValue;
  economy: ScoreValue;
  qualityOfLife: ScoreValue;
  demography: ScoreValue;
  completeness: ScoreValue;
  confidence: ScoreValue;
  uncertainty: ScoreValue;
  sourceReliability: ScoreValue;
  /** Null when no missing-indicator list was stored. An empty array means none were missing. */
  missingVariables: string[] | null;
};

export type NationalContextIndicator = {
  country: string;
  countryCode: string;
  region: string;
  subRegion: string;
  source: string;
  proportion: { value: number; year: number; sourceUrl: string } | null;
  population: { value: number; year: number; sourceUrl: string } | null;
};

export type ObservatoryFilters = {
  recordType: "all" | "atlas" | "community";
  status: "all" | string;
  country: "all" | string;
  scoreAvailability: "all" | "scored" | "unscored";
  completeness: "all" | "unknown" | "0-25" | "25-50" | "50-75" | "75-100";
};

export const DEFAULT_FILTERS: ObservatoryFilters = {
  recordType: "all",
  status: "all",
  country: "all",
  scoreAvailability: "all",
  completeness: "all",
};

export const UNKNOWN_COUNTRY = "Unknown";

const CALCULATOR_KEY_TO_VARIABLE: Record<string, string> = {
  water: "waterSatisfaction",
  sanitation: "sanitationSatisfaction",
  energy: "energySatisfaction",
  connectivity: "connectivitySatisfaction",
  mobility: "mobilitySatisfaction",
  condition: "housingConditionSatisfaction",
  materials: "materialsSatisfaction",
  developmentState: "structureDevelopmentScore",
  overcrowding: "peoplePerRoom",
  floors: "avgFloors",
  compactnessSatisfaction: "compactnessSatisfaction",
  unemploymentRate: "unemploymentRate",
  informalEmploymentRate: "informalEmploymentRate",
  insecureTenure: "insecureTenurePct",
  homeOwnershipInsecurityPct: "homeOwnershipInsecurityPct",
  residentsWorkingOutsidePct: "residentsWorkingOutsidePct",
  economicSatisfaction: "economicSatisfaction",
  foodInsecurity: "foodInsecurityPct",
  healthServiceGap: "withoutAffordableHealthPct",
  depressedPopulation: "depressedPct",
  leisureTimeGap: "insufficientLeisurePct",
  lifeExpectancy: "lifeExpectancy",
  genderEquality: "genderEquality",
  economicEquality: "economicEquality",
  adultLiteracy: "adultLiteracyRate",
  meanSchoolingYears: "meanYearsSchooling",
  hazardExposure: "siteHazardExposureScore",
  climateTags: "climateVulnerability",
  topographyRisk: "topography",
  originStress: "originType",
  withinCityStress: "withinCityCondition",
  communityVoice: "siteCommunityInfluenceScore",
};

const SCORE_BINS = [
  { label: "0.0–0.2", min: 0, max: 0.2 },
  { label: "0.2–0.4", min: 0.2, max: 0.4 },
  { label: "0.4–0.6", min: 0.4, max: 0.6 },
  { label: "0.6–0.8", min: 0.6, max: 0.8 },
  { label: "0.8–1.0", min: 0.8, max: 1.000001 },
] as const;

export function finiteScore(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export function parseMissingVariables(raw: string | null | undefined): string[] | null {
  if (raw == null || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return null;
  }
}

export function normalizeCountryName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\s+/g, " ");
}

export function countryLabel(country: string | null | undefined) {
  const trimmed = country?.trim();
  return trimmed ? trimmed : UNKNOWN_COUNTRY;
}

export function indicatorLabel(key: string) {
  const variable = CALCULATOR_KEY_TO_VARIABLE[key] ?? key;
  return QUESTIONNAIRE_QUESTIONS.find((question) => question.mapsToVariable === variable)?.label ?? key;
}

export function applyFilters(rows: SettlementObservation[], filters: ObservatoryFilters) {
  return rows.filter((row) => {
    if (filters.recordType === "atlas" && !row.atlasReference) return false;
    if (filters.recordType === "community" && row.atlasReference) return false;
    if (filters.status !== "all" && row.verificationStatus !== filters.status) return false;
    if (filters.country !== "all" && countryLabel(row.country) !== filters.country) return false;
    const scored = finiteScore(row.finalScore) !== null;
    if (filters.scoreAvailability === "scored" && !scored) return false;
    if (filters.scoreAvailability === "unscored" && scored) return false;
    if (filters.completeness !== "all" && !matchesCompleteness(row.completeness, filters.completeness)) return false;
    return true;
  });
}

function matchesCompleteness(value: ScoreValue, band: ObservatoryFilters["completeness"]) {
  if (band === "unknown") return finiteScore(value) === null;
  const score = finiteScore(value);
  if (score === null || score < 0) return false;
  if (band === "0-25") return score < 0.25;
  if (band === "25-50") return score >= 0.25 && score < 0.5;
  if (band === "50-75") return score >= 0.5 && score < 0.75;
  return score >= 0.75 && score <= 1;
}

export function valuesOf(rows: SettlementObservation[], pick: (row: SettlementObservation) => ScoreValue) {
  const values: number[] = [];
  for (const row of rows) {
    const value = finiteScore(pick(row));
    if (value !== null) values.push(value);
  }
  return values;
}

export function summarize(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    n: sorted.length,
    mean: sum / sorted.length,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

export function scoreHistogram(values: number[]) {
  return SCORE_BINS.map((bin) => {
    const count = values.filter((value) => value >= bin.min && value < bin.max).length;
    const percent = values.length ? (count / values.length) * 100 : 0;
    return { range: bin.label, count, percent };
  });
}

export function completenessHistogram(values: number[]) {
  const bins = [
    { label: "0–25%", min: 0, max: 0.25 },
    { label: "25–50%", min: 0.25, max: 0.5 },
    { label: "50–75%", min: 0.5, max: 0.75 },
    { label: "75–100%", min: 0.75, max: 1.000001 },
  ];
  return bins.map((bin) => {
    const count = values.filter((value) => value >= bin.min && value < bin.max).length;
    const percent = values.length ? (count / values.length) * 100 : 0;
    return { range: bin.label, count, percent };
  });
}

export type CountryCount = {
  country: string;
  total: number;
  atlas: number;
  community: number;
  scored: number;
};

export function settlementsByCountry(rows: SettlementObservation[]): CountryCount[] {
  const map = new Map<string, CountryCount>();
  for (const row of rows) {
    const country = countryLabel(row.country);
    const current = map.get(country) ?? { country, total: 0, atlas: 0, community: 0, scored: 0 };
    current.total += 1;
    if (row.atlasReference) current.atlas += 1;
    else current.community += 1;
    if (finiteScore(row.finalScore) !== null) current.scored += 1;
    map.set(country, current);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total || a.country.localeCompare(b.country));
}

export function missingIndicatorFrequency(rows: SettlementObservation[]) {
  const community = rows.filter((row) => !row.atlasReference && row.missingVariables !== null);
  const counts = new Map<string, number>();
  for (const row of community) {
    for (const key of row.missingVariables ?? []) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const items = Array.from(counts.entries())
    .map(([key, count]) => ({
      key,
      label: indicatorLabel(key),
      count,
      percent: community.length ? (count / community.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { denominator: community.length, items };
}

export function dimensionCoverage(rows: SettlementObservation[], pick: (row: SettlementObservation) => ScoreValue) {
  let available = 0;
  for (const row of rows) {
    if (finiteScore(pick(row)) !== null) available += 1;
  }
  return { available, missing: rows.length - available, total: rows.length };
}

export function findNationalContext(country: string | null | undefined, nationals: NationalContextIndicator[]) {
  if (!country?.trim()) return null;
  const target = normalizeCountryName(country);
  return nationals.find((item) => normalizeCountryName(item.country) === target) ?? null;
}

export function overviewOf(rows: SettlementObservation[]) {
  const community = rows.filter((row) => !row.atlasReference);
  const completenessValues = valuesOf(community, (row) => row.completeness);
  const completeness = summarize(completenessValues);
  const countries = new Set(rows.map((row) => countryLabel(row.country)).filter((country) => country !== UNKNOWN_COUNTRY));
  const statusCounts = new Map<string, number>();
  for (const row of rows) {
    statusCounts.set(row.verificationStatus, (statusCounts.get(row.verificationStatus) ?? 0) + 1);
  }
  return {
    total: rows.length,
    atlas: rows.filter((row) => row.atlasReference).length,
    community: community.length,
    scored: valuesOf(rows, (row) => row.finalScore).length,
    countries: countries.size,
    completeness,
    statusCounts: Array.from(statusCounts.entries()).sort((a, b) => b[1] - a[1]),
  };
}
