import seed from "../data/seed-settlements.json";
import { calculateAreaM2, calculateCentroid } from "../src/lib/geo";
import { calculateInformalityScore } from "../src/lib/informalityCalculator";
import { prisma } from "../src/lib/prisma";
export {};

async function main() {
  for (const record of seed) {
    const geometry = record.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
    const scores = calculateInformalityScore(record.answers ?? {});
    await prisma.settlement.create({
      data: {
        name: record.name,
        localName: record.localName,
        city: record.city,
        country: record.country,
        geometry: JSON.stringify(geometry),
        centroid: JSON.stringify(calculateCentroid(geometry)),
        areaM2: calculateAreaM2(geometry),
        population: record.population,
        source: record.source,
        sourceUrl: record.sourceUrl,
        atlasReference: Boolean((record as { atlasReference?: boolean }).atlasReference),
        createdBy: "seed-script",
        verificationStatus: "submitted",
        surveyResponses: {
          create: {
            rawAnswersJson: JSON.stringify(record.answers ?? {}),
            confidence: 0.85,
            notes: "Demo seed import (illustrative)",
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
  console.log(`Seeded ${seed.length} settlements`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
