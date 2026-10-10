import shpwrite from "shp-write";
import { NextResponse } from "next/server";
import { getFilteredSettlements } from "@/lib/exportFilters";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const settlements = await getFilteredSettlements(url.searchParams);
  const valid = settlements.filter((s) => Boolean(s.geometry));
  const geojson = {
    type: "FeatureCollection",
    features: valid.map((s) => ({
      type: "Feature",
      properties: {
        id: s.id,
        name: s.name,
        city: s.city,
        country: s.country,
        score: s.calculatedScores[0]?.finalInformalityScore ?? null,
        percentile: s.calculatedScores[0]?.globalPercentileRank ?? null,
        uncertainty: s.calculatedScores[0]?.uncertaintyScore ?? null,
      },
      geometry: JSON.parse(s.geometry ?? "{\"type\":\"Point\",\"coordinates\":[0,0]}"),
    })),
  } as GeoJSON.FeatureCollection;

  const buffer = shpwrite.zip(geojson);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=settlements-shapefile.zip",
    },
  });
}
