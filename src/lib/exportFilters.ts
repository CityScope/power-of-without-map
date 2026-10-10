import { prisma } from "@/lib/prisma";

export type SettlementLike = {
  id?: string;
  name?: string;
  city?: string | null;
  country?: string | null;
  areaM2?: number;
  population?: number | null;
  verificationStatus?: string;
  geometry?: string;
  centroid?: string;
  calculatedScores: Array<{
    finalInformalityScore?: number | null;
    globalPercentileRank?: number | null;
    completenessScore?: number | null;
    uncertaintyScore?: number | null;
  }>;
};

export function applySettlementFilters(
  settlements: SettlementLike[],
  filters: { country?: string | null; minScore?: string | null; maxScore?: string | null; minCompleteness?: string | null },
) {
  return settlements.filter((s) => {
    if (filters.country && s.country !== filters.country) return false;
    const score = s.calculatedScores[0]?.finalInformalityScore;
    const completeness = s.calculatedScores[0]?.completenessScore;
    if (filters.minScore !== null && filters.minScore !== undefined && score !== null && score !== undefined && score < Number(filters.minScore)) return false;
    if (filters.maxScore !== null && filters.maxScore !== undefined && score !== null && score !== undefined && score > Number(filters.maxScore)) return false;
    if (
      filters.minCompleteness !== null &&
      filters.minCompleteness !== undefined &&
      completeness !== null &&
      completeness !== undefined &&
      completeness < Number(filters.minCompleteness)
    )
      return false;
    return true;
  });
}

export async function getFilteredSettlements(searchParams: URLSearchParams) {
  const country = searchParams.get("country");
  const minScore = searchParams.get("minScore");
  const maxScore = searchParams.get("maxScore");
  const minCompleteness = searchParams.get("minCompleteness");

  const settlements = await prisma.settlement.findMany({
    where: country ? { country } : undefined,
    include: { calculatedScores: { orderBy: { calculatedAt: "desc" }, take: 1 } },
  });

  return applySettlementFilters(settlements, { country, minScore, maxScore, minCompleteness });
}
