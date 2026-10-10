import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeAndPersistScore } from "@/lib/scoringPipeline";
import { SurveyAnswers } from "@/types/informality";

type Body = {
  acceptedKeys: string[];
  rejectedKeys: string[];
  userId?: string;
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as Body;
  const settlement = await prisma.settlement.findUnique({
    where: { id },
    include: {
      surveyResponses: { orderBy: { submittedAt: "desc" }, take: 1 },
      enrichments: { orderBy: { lastCheckedAt: "desc" }, take: 1 },
    },
  });
  if (!settlement) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const latestSurvey = settlement.surveyResponses[0];
  const latestEnrichment = settlement.enrichments[0];
  if (!latestSurvey || !latestEnrichment) return NextResponse.json({ error: "Survey or enrichment missing" }, { status: 400 });

  const currentAnswers = JSON.parse(latestSurvey.rawAnswersJson) as SurveyAnswers;
  const suggested = JSON.parse(latestEnrichment.suggestedValuesJson ?? "{}") as Record<string, unknown>;
  const enrichmentMeta = JSON.parse(latestEnrichment.atlasJson ?? "{}") as Record<string, { confidence?: "high" | "medium" | "low" }>;
  const acceptedEntries = Object.fromEntries(body.acceptedKeys.map((key) => [key, suggested[key] ?? null]));
  const mergedAnswers = { ...currentAnswers, ...acceptedEntries } as SurveyAnswers;

  await prisma.surveyResponse.create({
    data: {
      settlementId: id,
      rawAnswersJson: JSON.stringify(mergedAnswers),
      calculationVersion: "v3-enrichment",
      submittedBy: body.userId ?? "reviewer",
      confidence: null,
      notes: "Applied enrichment suggestions",
    },
  });
  await computeAndPersistScore({
    settlementId: id,
    answers: mergedAnswers,
    source: settlement.source,
    enrichmentMeta,
    calculationVersion: "v3-enrichment",
  });
  await prisma.openDataEnrichment.update({
    where: { id: latestEnrichment.id },
    data: {
      acceptedValuesJson: JSON.stringify(body.acceptedKeys),
      rejectedValuesJson: JSON.stringify(body.rejectedKeys),
    },
  });
  await prisma.auditLog.create({
    data: {
      settlementId: id,
      action: "apply_open_data_suggestions",
      oldValueJson: JSON.stringify(currentAnswers),
      newValueJson: JSON.stringify(mergedAnswers),
      userId: body.userId,
    },
  });

  return NextResponse.json({ ok: true, accepted: body.acceptedKeys.length, rejected: body.rejectedKeys.length });
}
