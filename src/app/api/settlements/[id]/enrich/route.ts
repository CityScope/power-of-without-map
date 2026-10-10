import { NextResponse } from "next/server";
import { hashGeometry } from "@/lib/hash";
import { prisma } from "@/lib/prisma";
import { runOpenDataEnrichment } from "@/lib/openDataEnrichment";

const rateLimitBucket = new Map<string, number[]>();

function limited(key: string, windowMs = 60_000, maxHits = 8) {
  const now = Date.now();
  const current = (rateLimitBucket.get(key) ?? []).filter((t) => now - t < windowMs);
  if (current.length >= maxHits) return true;
  current.push(now);
  rateLimitBucket.set(key, current);
  return false;
}

async function runAndPersist(id: string, geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon, country?: string, city?: string) {
  const geometryHash = hashGeometry(geometry);
  const cached = await prisma.openDataEnrichment.findFirst({
    where: { settlementId: id, geometryHash, enrichmentStatus: "partial" },
    orderBy: { lastCheckedAt: "desc" },
  });
  if (cached) {
    const touch = await prisma.openDataEnrichment.update({
      where: { id: cached.id },
      data: { cacheHit: true, lastCheckedAt: new Date() },
    });
    return { enrichment: touch, cached: true };
  }

  const result = await runOpenDataEnrichment(geometry, country, city);
  const enrichment = await prisma.openDataEnrichment.create({
    data: {
      settlementId: id,
      geometryHash,
      osmJson: JSON.stringify(result.osm),
      unhabitatJson: JSON.stringify(result.unhabitat),
      beamJson: JSON.stringify(result.report),
      atlasJson: JSON.stringify(result.suggestedMeta),
      queryEnvelopeJson: JSON.stringify((result.osm as Record<string, unknown>).nearbyBbox ?? null),
      cacheHit: false,
      suggestedValuesJson: JSON.stringify(result.suggestedValues),
      calculationVersion: "v3-phase3",
      enrichmentStatus: result.status,
      lastCheckedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      settlementId: id,
      action: "open_data_enriched",
      newValueJson: JSON.stringify(result),
    },
  });
  return { enrichment, cached: false };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (limited(`${ip}:${id}`)) return NextResponse.json({ error: "Rate limit exceeded for enrichment" }, { status: 429 });

  const settlement = await prisma.settlement.findUnique({ where: { id } });
  if (!settlement) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const geometry = JSON.parse(settlement.geometry) as GeoJSON.Polygon | GeoJSON.MultiPolygon;
  const url = new URL(req.url);
  const background = url.searchParams.get("background") === "true";
  if (background) {
    void runAndPersist(id, geometry, settlement.country ?? undefined, settlement.city ?? undefined);
    return NextResponse.json({ queued: true, message: "Background enrichment started." }, { status: 202 });
  }
  const { enrichment, cached } = await runAndPersist(id, geometry, settlement.country ?? undefined, settlement.city ?? undefined);

  return NextResponse.json({ enrichment, cached });
}
