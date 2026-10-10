import { NextResponse } from "next/server";
import { getNationalContextIndicators } from "@/lib/contextualIndicatorAnalytics";
import { finiteScore, parseMissingVariables, type SettlementObservation } from "@/lib/analyticsObservatory";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function storedScore(value: number | null | undefined) {
  return finiteScore(value);
}

const scoreSelect = {
  settlementId: true,
  calculatedAt: true,
  finalInformalityScore: true,
  architectureScore: true,
  populaceScore: true,
  sitePillarScore: true,
  infrastructureScore: true,
  physicalNatureScore: true,
  compactnessScore: true,
  economyScore: true,
  qualityOfLifeScore: true,
  demographyScore: true,
  completenessScore: true,
  confidenceScore: true,
  uncertaintyScore: true,
  sourceReliabilityScore: true,
  missingVariablesJson: true,
} as const;

export async function GET() {
  try {
    const [settlements, scoreRows, nationalIndicators] = await Promise.all([
      prisma.settlement.findMany({
        select: {
          id: true,
          name: true,
          country: true,
          city: true,
          atlasReference: true,
          verificationStatus: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.calculatedScore.findMany({
        orderBy: { calculatedAt: "desc" },
        select: scoreSelect,
      }),
      getNationalContextIndicators(),
    ]);

    const latestScoreBySettlement = new Map<string, (typeof scoreRows)[number]>();
    for (const score of scoreRows) {
      const current = latestScoreBySettlement.get(score.settlementId);
      if (!current || score.calculatedAt > current.calculatedAt) {
        latestScoreBySettlement.set(score.settlementId, score);
      }
    }

    const observations: SettlementObservation[] = settlements.map((settlement) => {
      const score = latestScoreBySettlement.get(settlement.id);
      return {
        id: settlement.id,
        name: settlement.name,
        country: settlement.country,
        city: settlement.city,
        atlasReference: settlement.atlasReference,
        verificationStatus: settlement.verificationStatus,
        finalScore: storedScore(score?.finalInformalityScore),
        architecture: storedScore(score?.architectureScore),
        populace: storedScore(score?.populaceScore),
        site: storedScore(score?.sitePillarScore),
        infrastructure: storedScore(score?.infrastructureScore),
        physicalNature: storedScore(score?.physicalNatureScore),
        compactness: storedScore(score?.compactnessScore),
        economy: storedScore(score?.economyScore),
        qualityOfLife: storedScore(score?.qualityOfLifeScore),
        demography: storedScore(score?.demographyScore),
        completeness: storedScore(score?.completenessScore),
        confidence: storedScore(score?.confidenceScore),
        uncertainty: storedScore(score?.uncertaintyScore),
        sourceReliability: storedScore(score?.sourceReliabilityScore),
        missingVariables: score ? parseMissingVariables(score.missingVariablesJson) : null,
      };
    });

    return NextResponse.json({ settlements: observations, nationalIndicators });
  } catch (error) {
    console.error("GET /api/analytics failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
