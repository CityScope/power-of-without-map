import { NextResponse } from "next/server";
import { getFilteredSettlements } from "@/lib/exportFilters";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const settlements = await getFilteredSettlements(url.searchParams);
  const valid = settlements.filter((s) => Boolean(s.geometry));
  const featureCollection = {
    type: "FeatureCollection",
    features: valid.map((settlement) => ({
      type: "Feature",
      properties: {
        id: settlement.id,
        name: settlement.name,
        city: settlement.city,
        country: settlement.country,
        area_m2: settlement.areaM2,
        population: settlement.population,
        informality_score: settlement.calculatedScores[0]?.finalInformalityScore ?? null,
        global_percentile_rank: settlement.calculatedScores[0]?.globalPercentileRank ?? null,
        completeness: settlement.calculatedScores[0]?.completenessScore ?? null,
        uncertainty_score: settlement.calculatedScores[0]?.uncertaintyScore ?? null,
      },
      geometry: JSON.parse(settlement.geometry ?? "{\"type\":\"Point\",\"coordinates\":[0,0]}"),
    })),
  };
  return NextResponse.json(featureCollection);
}
