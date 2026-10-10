import { calculateInformalityScore } from "@/lib/informalityCalculator";
import { FORMULA_VERSION, NORMALIZATION_VERSION, normalizeIndicators, percentileRank } from "@/lib/normalization";
import { prisma } from "@/lib/prisma";
import { SurveyAnswers } from "@/types/informality";

function sourceReliability(source?: string | null) {
  const s = (source ?? "").toLowerCase();
  if (s.includes("government")) return 0.9;
  if (s.includes("ngo")) return 0.8;
  if (s.includes("research")) return 0.75;
  if (s.includes("community")) return 0.6;
  if (s.includes("satellite") || s.includes("open-data")) return 0.55;
  return 0.5;
}

function osmConfidence(enrichmentMeta?: Record<string, { confidence?: "high" | "medium" | "low" }>): number {
  if (!enrichmentMeta || Object.keys(enrichmentMeta).length === 0) return 0.4;
  const vals = Object.values(enrichmentMeta).map((m) => (m.confidence === "high" ? 0.9 : m.confidence === "medium" ? 0.65 : 0.4));
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export async function computeAndPersistScore(params: {
  settlementId: string;
  answers: SurveyAnswers;
  source?: string | null;
  calculationVersion: string;
  enrichmentMeta?: Record<string, { confidence?: "high" | "medium" | "low" }>;
  db?: Pick<typeof prisma, "calculatedScore">;
}) {
  const score = calculateInformalityScore(params.answers);
  const normalized = normalizeIndicators(params.answers);
  const rawValues = Object.fromEntries(normalized.map((i) => [i.key, i.raw]));
  const normalizedValues = Object.fromEntries(normalized.map((i) => [i.key, i.normalized]));
  const weights = {
    infrastructure: { water: 0.3, sanitation: 0.3, energy: 0.2, connectivity: 0.1, mobility: 0.1 },
    architecture: { infrastructure: 1 / 3, physicalNature: 1 / 3, compactness: 1 / 3 },
    populace: { economy: 1 / 3, qualityOfLife: 1 / 3, demography: 1 / 3 },
    economy: {
      unemploymentRate: 0.18,
      informalEmploymentRate: 0.16,
      insecureTenure: 0.18,
      homeOwnershipInsecurityPct: 0.15,
      residentsWorkingOutsidePct: 0.15,
      economicSatisfaction: 0.18,
    },
    sitePillar: {
      hazardExposure: 0.22,
      climateTags: 0.18,
      topographyRisk: 0.12,
      originStress: 0.18,
      withinCityStress: 0.15,
      communityVoice: 0.15,
    },
    final: { architecture: 0.5, populace: 0.5 },
  };

  const db = params.db ?? prisma;
  const previousScores = await db.calculatedScore.findMany({
    where: { finalInformalityScore: { not: null } },
    select: { finalInformalityScore: true },
  });
  const population = previousScores.map((s) => s.finalInformalityScore as number);
  const globalPercentile = percentileRank(score.finalScore, population);

  const completeness = score.completeness;
  const confidence = osmConfidence(params.enrichmentMeta);
  const reliability = sourceReliability(params.source);
  const uncertainty = 1 - (0.5 * completeness + 0.25 * confidence + 0.25 * reliability);

  const baseData = {
    settlementId: params.settlementId,
    architectureScore: score.architecture.score,
    infrastructureScore: score.infrastructure.score,
    physicalNatureScore: score.physicalNature.score,
    compactnessScore: score.compactness.score,
    populaceScore: score.populace.score,
    economyScore: score.economy.score,
    qualityOfLifeScore: score.qualityOfLife.score,
    demographyScore: score.demography.score,
    siteProfileJson: JSON.stringify(score.siteProfile),
    sitePillarScore: score.sitePillar.score,
    finalInformalityScore: score.finalScore,
    globalPercentileRank: globalPercentile,
    completenessScore: completeness,
    confidenceScore: confidence,
    sourceReliabilityScore: reliability,
    uncertaintyScore: Math.max(0, Math.min(1, uncertainty)),
    missingVariablesJson: JSON.stringify(score.missingVariables),
    rawValuesJson: JSON.stringify(rawValues),
    normalizedValuesJson: JSON.stringify(normalizedValues),
    weightsJson: JSON.stringify(weights),
    formulaVersion: FORMULA_VERSION,
    normalizationVersion: NORMALIZATION_VERSION,
    calculationVersion: params.calculationVersion,
  };

  let created;
  try {
    created = await db.calculatedScore.create({ data: baseData });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Backward compatibility for environments where Prisma client/schema is not yet refreshed.
    if (message.includes("Unknown argument `sitePillarScore`")) {
      const legacyData = { ...baseData };
      delete (legacyData as { sitePillarScore?: number | null }).sitePillarScore;
      created = await db.calculatedScore.create({ data: legacyData });
    } else {
      throw error;
    }
  }

  return { score, created };
}
