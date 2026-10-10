import { NextResponse } from "next/server";
import { calculateAreaM2, calculateCentroid } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import { computeAndPersistScore } from "@/lib/scoringPipeline";
import { settlementInputSchema } from "@/lib/schemas";
import { settlementJsonWithAtlasReference } from "@/lib/settlementJson";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const settlement = await prisma.settlement.findUnique({
    where: { id },
    include: {
      calculatedScores: { orderBy: { calculatedAt: "desc" }, take: 1 },
      surveyResponses: { orderBy: { submittedAt: "desc" }, take: 1 },
      enrichments: true,
      auditLogs: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!settlement) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(settlementJsonWithAtlasReference(settlement));
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = settlementInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const geometry = parsed.data.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
  const areaM2 = calculateAreaM2(geometry);
  const centroid = calculateCentroid(geometry);
  const answers = parsed.data.answers ?? {};
  const latestEnrichment = await prisma.openDataEnrichment.findFirst({
    where: { settlementId: id },
    orderBy: { lastCheckedAt: "desc" },
  });
  const enrichmentMeta = JSON.parse(latestEnrichment?.atlasJson ?? "{}") as Record<string, { confidence?: "high" | "medium" | "low" }>;

  const settlement = await prisma.settlement.update({
    where: { id },
    data: {
      name: parsed.data.name,
      localName: parsed.data.localName,
      city: parsed.data.city,
      country: parsed.data.country,
      geometry: JSON.stringify(geometry),
      centroid: JSON.stringify(centroid),
      areaM2,
      population: parsed.data.population,
      source: parsed.data.source,
      sourceUrl: parsed.data.sourceUrl,
      verificationStatus: parsed.data.verificationStatus,
      updatedAt: new Date(),
      surveyResponses: {
        create: {
          rawAnswersJson: JSON.stringify(answers),
          calculationVersion: "v3-phase3",
          confidence: parsed.data.confidence ?? null,
          notes: parsed.data.notes,
          submittedBy: parsed.data.createdBy,
        },
      },
      auditLogs: {
        create: {
          action: "update_settlement",
          newValueJson: JSON.stringify(parsed.data),
          userId: parsed.data.createdBy,
        },
      },
    },
    include: { surveyResponses: true },
  });
  const persisted = await computeAndPersistScore({
    settlementId: id,
    answers,
    source: parsed.data.source,
    enrichmentMeta,
    calculationVersion: "v3-phase3",
  });

  return NextResponse.json({
    ...settlementJsonWithAtlasReference(settlement),
    calculatedScores: [persisted.created],
  });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.settlement.findUnique({
    where: { id },
    select: { id: true, atlasReference: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.atlasReference === true) {
    return NextResponse.json(
      { error: "Atlas reference records cannot be deleted here." },
      { status: 403 },
    );
  }
  await prisma.settlement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
