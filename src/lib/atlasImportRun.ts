import { computeAndPersistScore } from "@/lib/scoringPipeline";
import { prisma } from "@/lib/prisma";
import type { SurveyAnswers } from "@/types/informality";
import {
  geometryToSettlementPolygon,
  nameFromFeatureProperties,
  textProp,
} from "@/lib/atlasGeoImport";
import { calculateAreaM2, calculateCentroid } from "@/lib/geo";

const ATLAS_SOURCE = "Atlas of Informality";

export const ATLAS_IMPORT_SOURCE = ATLAS_SOURCE;

export type AtlasImportResult = {
  createdCount: number;
  settlementIds: string[];
  skipped: string[];
  /** Prisma row counts after this import (verification). */
  dbAtlasReference: { true: number; false: number };
};

export async function importAtlasFeatures(
  features: GeoJSON.Feature[],
  options: {
    source?: string;
    sourceUrl?: string | null;
    createdBy?: string;
    notes?: string;
    auditAction?: string;
    verificationStatus?: "draft" | "submitted" | "reviewed" | "verified" | "rejected";
  } = {},
): Promise<AtlasImportResult> {
  const source = options.source ?? ATLAS_SOURCE;
  const verificationStatus = options.verificationStatus ?? "submitted";
  const sourceUrl = options.sourceUrl ?? null;
  const createdBy = options.createdBy ?? "atlas-import";
  const notes = options.notes ?? "Atlas of Informality reference import";
  const auditAction = options.auditAction ?? "import_atlas_geojson";

  const created: string[] = [];
  const skipped: string[] = [];

  for (let i = 0; i < features.length; i += 1) {
    const f = features[i];
    const g = f.geometry;
    if (!g) {
      skipped.push(`feature[${i}]: no geometry`);
      continue;
    }
    const poly = geometryToSettlementPolygon(g);
    if (!poly) {
      skipped.push(`feature[${i}]: unsupported geometry type ${g.type}`);
      continue;
    }
    const props = (f.properties ?? undefined) as Record<string, unknown> | undefined;
    const name = nameFromFeatureProperties(props, i);
    const localName = textProp(props, "localName", "local");
    const city = textProp(props, "city", "City", "CITY");
    const country = textProp(props, "country", "Country", "COUNTRY", "COUNTRY_NM");

    const areaM2 = calculateAreaM2(poly);
    const centroid = calculateCentroid(poly);
    const answers = {} as SurveyAnswers;

    const settlement = await prisma.settlement.create({
      data: {
        name,
        localName: localName ?? null,
        city: city ?? null,
        country: country ?? null,
        geometry: JSON.stringify(poly),
        centroid: JSON.stringify(centroid),
        areaM2,
        population: null,
        source,
        sourceUrl,
        /* Atlas import pipeline: always reference layer (never default false from schema) */
        atlasReference: true,
        createdBy,
        verificationStatus,
        surveyResponses: {
          create: {
            rawAnswersJson: JSON.stringify(answers),
            calculationVersion: "v3-phase3",
            notes,
          },
        },
        auditLogs: {
          create: {
            action: auditAction,
            newValueJson: JSON.stringify({ name, index: i }),
            userId: createdBy,
          },
        },
      },
      include: { surveyResponses: true },
    });

    await computeAndPersistScore({
      settlementId: settlement.id,
      answers,
      source,
      calculationVersion: "v3-phase3",
    });
    created.push(settlement.id);
  }

  const [trueCount, falseCount] = await Promise.all([
    prisma.settlement.count({ where: { atlasReference: true } }),
    prisma.settlement.count({ where: { atlasReference: false } }),
  ]);
  console.log(
    `[atlas import] DB verification — atlasReference=true: ${trueCount}, atlasReference=false: ${falseCount} (run created ${created.length} row(s))`,
  );

  return {
    createdCount: created.length,
    settlementIds: created,
    skipped,
    dbAtlasReference: { true: trueCount, false: falseCount },
  };
}

export function parseFeaturesFromGeoRoot(root: unknown): GeoJSON.Feature[] {
  if (!root || typeof root !== "object") return [];
  const o = root as GeoJSON.GeoJsonObject;
  if (o.type === "FeatureCollection") {
    const fc = o as GeoJSON.FeatureCollection;
    return fc.features.filter((f): f is GeoJSON.Feature => f.type === "Feature");
  }
  if (o.type === "Feature") {
    return [o as GeoJSON.Feature];
  }
  return [];
}
