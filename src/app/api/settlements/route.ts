import { NextResponse } from "next/server";
import { calculateAreaM2, calculateCentroid } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import { computeAndPersistScore } from "@/lib/scoringPipeline";
import { settlementInputSchema } from "@/lib/schemas";
import { settlementJsonWithAtlasReference } from "@/lib/settlementJson";
import { fetchLatestInformalityScoresBySettlementId } from "@/lib/settlementListScores";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await prisma.settlement.findMany({
      select: {
        id: true,
        name: true,
        country: true,
        city: true,
        geometry: true,
        centroid: true,
        atlasReference: true,
        verificationStatus: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    // Atlas bubbles use a fixed radius; only community rows need scores on the map list.
    const communityIds = rows.filter((s) => !s.atlasReference).map((s) => s.id);
    let latestScoreBySettlementId = new Map<string, { finalInformalityScore: number | null }>();
    try {
      latestScoreBySettlementId = await fetchLatestInformalityScoresBySettlementId(communityIds);
    } catch (scoreError) {
      console.error("GET /api/settlements: score lookup failed, returning settlements without scores", scoreError);
    }

    const payload = rows.map((s) => {
      const latest = latestScoreBySettlementId.get(s.id);
      return {
        ...settlementJsonWithAtlasReference(s),
        calculatedScores: latest ? [latest] : [],
      };
    });

    return new NextResponse(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    console.error("GET /api/settlements failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = settlementInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const geometry = parsed.data.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
  const areaM2 = calculateAreaM2(geometry);
  const centroid = calculateCentroid(geometry);
  const answers = parsed.data.answers ?? {};

  const settlement = await prisma.settlement.create({
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
      atlasReference: parsed.data.atlasReference,
      createdBy: parsed.data.createdBy,
      verificationStatus: parsed.data.verificationStatus,
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
          action: "create_settlement",
          newValueJson: JSON.stringify(parsed.data),
          userId: parsed.data.createdBy,
        },
      },
    },
    include: { surveyResponses: true },
  });
  const persisted = await computeAndPersistScore({
    settlementId: settlement.id,
    answers,
    source: parsed.data.source,
    calculationVersion: "v3-phase3",
  });

  return NextResponse.json(
    { ...settlementJsonWithAtlasReference(settlement), calculatedScores: [persisted.created] },
    { status: 201 },
  );
}
