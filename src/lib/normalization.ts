import { SurveyAnswers } from "@/types/informality";

export const NORMALIZATION_VERSION = "norm-v1";
export const FORMULA_VERSION = "formula-v1";

export type NormalizedIndicator = {
  key: string;
  raw: number | null;
  normalized: number | null;
  direction: "higher_is_worse";
  note: string;
};

function toNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalize(raw: number | null, min: number, max: number, invert = false): number | null {
  if (raw === null) return null;
  if (max <= min) return null;
  const clamped = Math.max(min, Math.min(max, raw));
  const v = (clamped - min) / (max - min);
  return invert ? 1 - v : v;
}

// All indicators are transformed to "higher = more informal".
export function normalizeIndicators(answers: SurveyAnswers): NormalizedIndicator[] {
  const mapping: Array<{
    key: string;
    sourceKey: string;
    min: number;
    max: number;
    invert?: boolean;
    note: string;
  }> = [
    { key: "waterSatisfaction", sourceKey: "waterSatisfaction", min: 0, max: 1, invert: true, note: "Satisfaction inverted to deprivation." },
    { key: "sanitationSatisfaction", sourceKey: "sanitationSatisfaction", min: 0, max: 1, invert: true, note: "Satisfaction inverted to deprivation." },
    { key: "energySatisfaction", sourceKey: "energySatisfaction", min: 0, max: 1, invert: true, note: "Satisfaction inverted to deprivation." },
    { key: "connectivitySatisfaction", sourceKey: "connectivitySatisfaction", min: 0, max: 1, invert: true, note: "Satisfaction inverted to deprivation." },
    { key: "mobilitySatisfaction", sourceKey: "mobilitySatisfaction", min: 0, max: 1, invert: true, note: "Satisfaction inverted to deprivation." },
    { key: "housingConditionSatisfaction", sourceKey: "housingConditionSatisfaction", min: 0, max: 1, invert: true, note: "Good housing maps to lower informality." },
    { key: "materialsSatisfaction", sourceKey: "materialsSatisfaction", min: 0, max: 1, invert: true, note: "Good materials maps to lower informality." },
    { key: "structureDevelopmentScore", sourceKey: "structureDevelopmentScore", min: 0, max: 1, invert: true, note: "Higher development maps to lower informality." },
    { key: "peoplePerRoom", sourceKey: "peoplePerRoom", min: 0, max: 8, note: "Overcrowding directly increases informality." },
    { key: "avgFloors", sourceKey: "avgFloors", min: 1, max: 8, invert: true, note: "More floors can indicate consolidation; inverted." },
    { key: "compactnessSatisfaction", sourceKey: "compactnessSatisfaction", min: 0, max: 1, invert: true, note: "Satisfaction inverted to deprivation." },
    { key: "unemploymentRate", sourceKey: "unemploymentRate", min: 0, max: 100, note: "Higher unemployment increases informality." },
    { key: "informalEmploymentRate", sourceKey: "informalEmploymentRate", min: 0, max: 100, note: "Higher informal labor increases informality." },
    { key: "insecureTenurePct", sourceKey: "insecureTenurePct", min: 0, max: 100, note: "Tenure insecurity increases informality." },
    { key: "homeOwnershipInsecurityPct", sourceKey: "homeOwnershipInsecurityPct", min: 0, max: 100, note: "Felt risk of losing home increases informality." },
    { key: "residentsWorkingOutsidePct", sourceKey: "residentsWorkingOutsidePct", min: 0, max: 100, note: "Dependency on distant work increases informality proxy." },
    { key: "economicSatisfaction", sourceKey: "economicSatisfaction", min: 0, max: 1, invert: true, note: "Satisfaction inverted to deprivation." },
    { key: "foodInsecurityPct", sourceKey: "foodInsecurityPct", min: 0, max: 100, note: "Food insecurity increases informality." },
    { key: "withoutAffordableHealthPct", sourceKey: "withoutAffordableHealthPct", min: 0, max: 100, note: "Health access gap increases informality." },
    { key: "depressedPct", sourceKey: "depressedPct", min: 0, max: 100, note: "Higher distress increases informality." },
    { key: "insufficientLeisurePct", sourceKey: "insufficientLeisurePct", min: 0, max: 100, note: "Leisure deprivation increases informality." },
    { key: "lifeExpectancy", sourceKey: "lifeExpectancy", min: 40, max: 90, invert: true, note: "Lower life expectancy means higher informality." },
    { key: "genderEquality", sourceKey: "genderEquality", min: 0, max: 1, invert: true, note: "Lower equality means higher informality." },
    { key: "economicEquality", sourceKey: "economicEquality", min: 0, max: 1, invert: true, note: "Lower equality means higher informality." },
    { key: "adultLiteracyRate", sourceKey: "adultLiteracyRate", min: 0, max: 100, invert: true, note: "Lower literacy means higher informality." },
    { key: "meanYearsSchooling", sourceKey: "meanYearsSchooling", min: 0, max: 16, invert: true, note: "Lower schooling means higher informality." },
    { key: "siteHazardExposureScore", sourceKey: "siteHazardExposureScore", min: 0, max: 1, note: "Higher hazard exposure increases informality (site pillar)." },
    { key: "siteCommunityInfluenceScore", sourceKey: "siteCommunityInfluenceScore", min: 0, max: 1, invert: true, note: "More voice lowers site informality contribution." },
  ];

  return mapping.map((m) => {
    const raw = toNumber(answers[m.sourceKey]);
    return {
      key: m.key,
      raw,
      normalized: normalize(raw, m.min, m.max, m.invert),
      direction: "higher_is_worse",
      note: m.note,
    };
  });
}

export function percentileRank(value: number | null, population: number[]): number | null {
  if (value === null || !population.length) return null;
  const lessEq = population.filter((p) => p <= value).length;
  return lessEq / population.length;
}
