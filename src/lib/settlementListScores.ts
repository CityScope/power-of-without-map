import { prisma } from "@/lib/prisma";

const BATCH_SIZE = 400;

export type LatestInformalityScore = {
  finalInformalityScore: number | null;
};

/** Latest score per settlement; batches IDs to stay within SQLite variable limits. */
export async function fetchLatestInformalityScoresBySettlementId(
  settlementIds: string[],
): Promise<Map<string, LatestInformalityScore>> {
  const result = new Map<string, LatestInformalityScore>();
  if (settlementIds.length === 0) return result;

  for (let i = 0; i < settlementIds.length; i += BATCH_SIZE) {
    const chunk = settlementIds.slice(i, i + BATCH_SIZE);
    const scores = await prisma.calculatedScore.findMany({
      where: { settlementId: { in: chunk } },
      orderBy: { calculatedAt: "desc" },
      select: { settlementId: true, finalInformalityScore: true },
    });
    for (const score of scores) {
      if (!result.has(score.settlementId)) {
        result.set(score.settlementId, {
          finalInformalityScore: score.finalInformalityScore,
        });
      }
    }
  }

  return result;
}
