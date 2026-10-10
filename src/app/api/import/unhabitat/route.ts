import { NextResponse } from "next/server";
import { calculateAreaM2, calculateCentroid } from "@/lib/geo";
import { parseUNHabitatInput } from "@/lib/unhabitatImporter";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    format: "csv" | "geojson" | "kml" | "shapefile" | "featureserver";
    content?: string;
    url?: string;
    sourceUrl?: string;
  };
  const features = await parseUNHabitatInput(body);
  let ingested = 0;
  for (const feature of features) {
    if (!feature.geometry) continue;
    if (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon") continue;
    const geometry = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
    await prisma.settlement.create({
      data: {
        name: String(feature.properties?.name ?? feature.properties?.NAME ?? `UN Habitat ${ingested + 1}`),
        city: String(feature.properties?.city ?? feature.properties?.CITY ?? ""),
        country: String(feature.properties?.country ?? feature.properties?.COUNTRY ?? ""),
        geometry: JSON.stringify(geometry),
        centroid: JSON.stringify(calculateCentroid(geometry)),
        areaM2: calculateAreaM2(geometry),
        source: "UN-Habitat",
        sourceUrl: body.sourceUrl ?? body.url ?? "https://data.unhabitat.org/pages/housing-slums-and-informal-settlements",
        verificationStatus: "submitted",
      },
    });
    ingested++;
  }
  return NextResponse.json({ ingested, format: body.format });
}
