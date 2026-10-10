import { CalculationResult, InformalityBand, InformalityScoreResult, NumericMaybe, SiteProfile, SurveyAnswers, WeightedInput } from "@/types/informality";

export function normalizeValue(value: NumericMaybe, min: number, max: number, invert = false): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (max <= min) return null;
  const clamped = Math.max(min, Math.min(max, value));
  const normalized = (clamped - min) / (max - min);
  return invert ? 1 - normalized : normalized;
}

export function weightedAverageAvailable(inputs: WeightedInput[]): CalculationResult {
  const valid = inputs.filter((input) => input.value !== null && input.value !== undefined);
  const missingKeys = inputs.filter((input) => input.value === null || input.value === undefined).map((i) => i.key);
  if (!valid.length) return { score: null, usedKeys: [], missingKeys };
  const totalWeight = valid.reduce((acc, curr) => acc + curr.weight, 0);
  if (!totalWeight) return { score: null, usedKeys: [], missingKeys };
  const weightedSum = valid.reduce((acc, curr) => acc + (curr.value as number) * curr.weight, 0);
  return { score: weightedSum / totalWeight, usedKeys: valid.map((i) => i.key), missingKeys };
}

export function calculateInfrastructure(answers: SurveyAnswers): CalculationResult {
  const water = normalizeValue(Number(answers.waterSatisfaction), 0, 1, true);
  const sanitation = normalizeValue(Number(answers.sanitationSatisfaction), 0, 1, true);
  const energy = normalizeValue(Number(answers.energySatisfaction), 0, 1, true);
  const connectivity = normalizeValue(Number(answers.connectivitySatisfaction), 0, 1, true);
  const mobility = normalizeValue(Number(answers.mobilitySatisfaction), 0, 1, true);
  return weightedAverageAvailable([
    { key: "water", value: water, weight: 0.3 },
    { key: "sanitation", value: sanitation, weight: 0.3 },
    { key: "energy", value: energy, weight: 0.2 },
    { key: "connectivity", value: connectivity, weight: 0.1 },
    { key: "mobility", value: mobility, weight: 0.1 },
  ]);
}

export function calculatePhysicalNature(answers: SurveyAnswers): CalculationResult {
  const condition = normalizeValue(Number(answers.housingConditionSatisfaction), 0, 1, true);
  const materials = normalizeValue(Number(answers.materialsSatisfaction), 0, 1, true);
  const development = normalizeValue(Number(answers.structureDevelopmentScore), 0, 1, true);
  return weightedAverageAvailable([
    { key: "condition", value: condition, weight: 1 / 3 },
    { key: "materials", value: materials, weight: 1 / 3 },
    { key: "developmentState", value: development, weight: 1 / 3 },
  ]);
}

export function calculateCompactness(answers: SurveyAnswers): CalculationResult {
  const overcrowding = normalizeValue(Number(answers.peoplePerRoom), 0, 8);
  const floors = normalizeValue(Number(answers.avgFloors), 1, 8, true);
  const satisfaction = normalizeValue(Number(answers.compactnessSatisfaction), 0, 1, true);
  return weightedAverageAvailable([
    { key: "overcrowding", value: overcrowding, weight: 0.45 },
    { key: "floors", value: floors, weight: 0.2 },
    { key: "compactnessSatisfaction", value: satisfaction, weight: 0.35 },
  ]);
}

export function calculateArchitecture(answers: SurveyAnswers): CalculationResult {
  const infrastructure = calculateInfrastructure(answers).score;
  const physical = calculatePhysicalNature(answers).score;
  const compactness = calculateCompactness(answers).score;
  return weightedAverageAvailable([
    { key: "infrastructure", value: infrastructure, weight: 1 / 3 },
    { key: "physicalNature", value: physical, weight: 1 / 3 },
    { key: "compactness", value: compactness, weight: 1 / 3 },
  ]);
}

export function calculateEconomy(answers: SurveyAnswers): CalculationResult {
  return weightedAverageAvailable([
    { key: "unemploymentRate", value: normalizeValue(Number(answers.unemploymentRate), 0, 100), weight: 0.18 },
    { key: "informalEmploymentRate", value: normalizeValue(Number(answers.informalEmploymentRate), 0, 100), weight: 0.16 },
    { key: "insecureTenure", value: normalizeValue(Number(answers.insecureTenurePct), 0, 100), weight: 0.18 },
    { key: "homeOwnershipInsecurityPct", value: normalizeValue(Number(answers.homeOwnershipInsecurityPct), 0, 100), weight: 0.15 },
    { key: "residentsWorkingOutsidePct", value: normalizeValue(Number(answers.residentsWorkingOutsidePct), 0, 100), weight: 0.15 },
    { key: "economicSatisfaction", value: normalizeValue(Number(answers.economicSatisfaction), 0, 1, true), weight: 0.18 },
  ]);
}

export function calculateQualityOfLife(answers: SurveyAnswers): CalculationResult {
  return weightedAverageAvailable([
    { key: "foodInsecurity", value: normalizeValue(Number(answers.foodInsecurityPct), 0, 100), weight: 0.3 },
    { key: "healthServiceGap", value: normalizeValue(Number(answers.withoutAffordableHealthPct), 0, 100), weight: 0.25 },
    { key: "depressedPopulation", value: normalizeValue(Number(answers.depressedPct), 0, 100), weight: 0.2 },
    { key: "leisureTimeGap", value: normalizeValue(Number(answers.insufficientLeisurePct), 0, 100), weight: 0.15 },
    { key: "lifeExpectancy", value: normalizeValue(Number(answers.lifeExpectancy), 40, 90, true), weight: 0.1 },
  ]);
}

export function calculateDemography(answers: SurveyAnswers): CalculationResult {
  return weightedAverageAvailable([
    { key: "genderEquality", value: normalizeValue(Number(answers.genderEquality), 0, 1, true), weight: 0.25 },
    { key: "economicEquality", value: normalizeValue(Number(answers.economicEquality), 0, 1, true), weight: 0.25 },
    { key: "adultLiteracy", value: normalizeValue(Number(answers.adultLiteracyRate), 0, 100, true), weight: 0.25 },
    { key: "meanSchoolingYears", value: normalizeValue(Number(answers.meanYearsSchooling), 0, 16, true), weight: 0.25 },
  ]);
}

export function calculatePopulace(answers: SurveyAnswers): CalculationResult {
  return weightedAverageAvailable([
    { key: "economy", value: calculateEconomy(answers).score, weight: 1 / 3 },
    { key: "qualityOfLife", value: calculateQualityOfLife(answers).score, weight: 1 / 3 },
    { key: "demography", value: calculateDemography(answers).score, weight: 1 / 3 },
  ]);
}

export function calculateSiteProfile(answers: SurveyAnswers): SiteProfile {
  return {
    origin: (answers.originType as string) || undefined,
    topography: (answers.topography as string)?.split(",").map((v) => v.trim()).filter(Boolean) ?? [],
    withinCityCondition: (answers.withinCityCondition as string) || undefined,
    climateVulnerability:
      (answers.climateVulnerability as string)?.split(",").map((v) => v.trim()).filter(Boolean) ?? [],
    securityNotes: (answers.securityNotes as string) || undefined,
    dignityNotes: (answers.dignityNotes as string) || undefined,
    narrative: (answers.narrative as string) || undefined,
  };
}

const ORIGIN_STRESS: Record<string, number> = {
  planned_relocation: 0.22,
  incremental_occupation: 0.55,
  crisis_occupation: 0.78,
  economic_anchor: 0.42,
  mixed_origin: 0.5,
};

const WITHIN_CITY_STRESS: Record<string, number> = {
  integrated_core: 0.18,
  periphery_moderate: 0.45,
  fragmented: 0.68,
  severed: 0.88,
};

function originStress(answers: SurveyAnswers): number | null {
  const o = (answers.originType as string)?.trim();
  if (!o) return null;
  return ORIGIN_STRESS[o] ?? null;
}

function withinCityStress(answers: SurveyAnswers): number | null {
  const w = (answers.withinCityCondition as string)?.trim();
  if (!w) return null;
  return WITHIN_CITY_STRESS[w] ?? null;
}

/** Hazard tags excluding benign "none". */
function climateTagCount(answers: SurveyAnswers): number | null {
  const raw = (answers.climateVulnerability as string)?.trim();
  if (!raw) return null;
  const tags = raw.split(",").map((t) => t.trim()).filter(Boolean).filter((t) => t !== "none");
  if (!tags.length) return null;
  return tags.length;
}

function topographyStress(answers: SurveyAnswers): number | null {
  const raw = (answers.topography as string)?.trim();
  if (!raw) return null;
  const tags = raw.split(",").map((t) => t.trim()).filter(Boolean);
  if (!tags.length) return null;
  const risky = tags.filter((t) => ["slope", "wetland", "debris", "arid"].includes(t)).length;
  return normalizeValue(risky, 0, 4, false);
}

/**
 * Site pillar: hazards, spatial integration stress, voice — computed only from available answers.
 * Not blended into `finalScore` (Architecture/Populace per SSRN-style core index).
 */
export function calculateSitePillar(answers: SurveyAnswers): CalculationResult {
  const hazardSlider = normalizeValue(Number(answers.siteHazardExposureScore), 0, 1, false);
  const voice = normalizeValue(Number(answers.siteCommunityInfluenceScore), 0, 1, true);
  const tagCount = climateTagCount(answers);
  const climateStress = tagCount === null ? null : normalizeValue(Math.min(tagCount, 4), 0, 4, false);
  const topo = topographyStress(answers);
  const origin = originStress(answers);
  const withinCity = withinCityStress(answers);
  return weightedAverageAvailable([
    { key: "hazardExposure", value: hazardSlider, weight: 0.22 },
    { key: "climateTags", value: climateStress, weight: 0.18 },
    { key: "topographyRisk", value: topo, weight: 0.12 },
    { key: "originStress", value: origin, weight: 0.18 },
    { key: "withinCityStress", value: withinCity, weight: 0.15 },
    { key: "communityVoice", value: voice, weight: 0.15 },
  ]);
}

function getBand(score: number | null): InformalityBand | null {
  if (score === null) return null;
  if (score < 0.2) return "Low informality";
  if (score < 0.4) return "Moderate-low";
  if (score < 0.6) return "Moderate";
  if (score < 0.8) return "High";
  return "Very high";
}

export function getMissingVariables(result: InformalityScoreResult): string[] {
  return Array.from(
    new Set([
      ...result.infrastructure.missingKeys,
      ...result.physicalNature.missingKeys,
      ...result.compactness.missingKeys,
      ...result.economy.missingKeys,
      ...result.qualityOfLife.missingKeys,
      ...result.demography.missingKeys,
      ...result.sitePillar.missingKeys,
    ]),
  );
}

export function getCompletenessScore(result: InformalityScoreResult): number {
  const total =
    result.infrastructure.usedKeys.length +
    result.infrastructure.missingKeys.length +
    result.physicalNature.usedKeys.length +
    result.physicalNature.missingKeys.length +
    result.compactness.usedKeys.length +
    result.compactness.missingKeys.length +
    result.economy.usedKeys.length +
    result.economy.missingKeys.length +
    result.qualityOfLife.usedKeys.length +
    result.qualityOfLife.missingKeys.length +
    result.demography.usedKeys.length +
    result.demography.missingKeys.length +
    result.sitePillar.usedKeys.length +
    result.sitePillar.missingKeys.length;
  const used =
    result.infrastructure.usedKeys.length +
    result.physicalNature.usedKeys.length +
    result.compactness.usedKeys.length +
    result.economy.usedKeys.length +
    result.qualityOfLife.usedKeys.length +
    result.demography.usedKeys.length +
    result.sitePillar.usedKeys.length;
  return total ? used / total : 0;
}

export function calculateInformalityScore(answers: SurveyAnswers): InformalityScoreResult {
  const infrastructure = calculateInfrastructure(answers);
  const physicalNature = calculatePhysicalNature(answers);
  const compactness = calculateCompactness(answers);
  const architecture = calculateArchitecture(answers);
  const economy = calculateEconomy(answers);
  const qualityOfLife = calculateQualityOfLife(answers);
  const demography = calculateDemography(answers);
  const populace = calculatePopulace(answers);
  const finalScore = weightedAverageAvailable([
    { key: "architecture", value: architecture.score, weight: 0.5 },
    { key: "populace", value: populace.score, weight: 0.5 },
  ]).score;
  const siteProfile = calculateSiteProfile(answers);
  const sitePillar = calculateSitePillar(answers);
  const draft: InformalityScoreResult = {
    infrastructure,
    physicalNature,
    compactness,
    architecture,
    economy,
    qualityOfLife,
    demography,
    populace,
    sitePillar,
    siteProfile,
    finalScore,
    completeness: 0,
    missingVariables: [],
    band: getBand(finalScore),
  };
  draft.missingVariables = getMissingVariables(draft);
  draft.completeness = getCompletenessScore(draft);
  return draft;
}
