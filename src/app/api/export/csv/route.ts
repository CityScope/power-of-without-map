import Papa from "papaparse";
import { NextResponse } from "next/server";
import { getFilteredSettlements } from "@/lib/exportFilters";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const settlements = await getFilteredSettlements(url.searchParams);
  const rows = settlements.map((s) => ({
    id: s.id,
    name: s.name,
    city: s.city,
    country: s.country,
    area_m2: s.areaM2,
    population: s.population,
    informality_score: s.calculatedScores[0]?.finalInformalityScore ?? "",
    global_percentile: s.calculatedScores[0]?.globalPercentileRank ?? "",
    completeness: s.calculatedScores[0]?.completenessScore ?? "",
    uncertainty_score: s.calculatedScores[0]?.uncertaintyScore ?? "",
    verification_status: s.verificationStatus,
  }));
  const csv = Papa.unparse(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=settlements.csv",
    },
  });
}
