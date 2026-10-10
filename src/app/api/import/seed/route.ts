import { NextResponse } from "next/server";
import seed from "../../../../../data/seed-settlements.json";
import { calculateAreaM2, calculateCentroid } from "@/lib/geo";
import { calculateInformalityScore } from "@/lib/informalityCalculator";
import { prisma } from "@/lib/prisma";

export async function POST() {
  for (const record of seed) {
    const geometry = record.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
    const areaM2 = calculateAreaM2(geometry);
    const c = calculateCentroid(geometry);
    const scores = calculateInformalityScore(record.answers ?? {});

    await prisma.settlement.create({
      data: {
        name: record.name,
        localName: record.localName,
        city: record.city,
        country: record.country,
        geometry: JSON.stringify(geometry),
        centroid: JSON.stringify(c),
        areaM2,
        population: record.population,
        source: record.source,
        sourceUrl: record.sourceUrl,
        createdBy: "seed-script",
        verificationStatus: "submitted",
        surveyResponses: {
          create: {
            rawAnswersJson: JSON.stringify(record.answers ?? {}),
            confidence: 0.8,
            notes: "Demo seed import (illustrative)",
            submittedBy: "seed-script",
          },
        },
        calculatedScores: {
          create: {
            architectureScore: scores.architecture.score,
            infrastructureScore: scores.infrastructure.score,
            physicalNatureScore: scores.physicalNature.score,
            compactnessScore: scores.compactness.score,
            populaceScore: scores.populace.score,
            economyScore: scores.economy.score,
            qualityOfLifeScore: scores.qualityOfLife.score,
            demographyScore: scores.demography.score,
            siteProfileJson: JSON.stringify(scores.siteProfile),
            sitePillarScore: scores.sitePillar.score,
            finalInformalityScore: scores.finalScore,
            completenessScore: scores.completeness,
            missingVariablesJson: JSON.stringify(scores.missingVariables),
          },
        },
      },
    });
  }
  return NextResponse.json({ imported: seed.length });
}
