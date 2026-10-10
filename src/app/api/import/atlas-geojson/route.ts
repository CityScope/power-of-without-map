import { NextResponse } from "next/server";
import { z } from "zod";
import { ATLAS_IMPORT_SOURCE, importAtlasFeatures, parseFeaturesFromGeoRoot } from "@/lib/atlasImportRun";

const bodySchema = z.object({
  sourceUrl: z.string().url().optional().nullable(),
  verificationStatus: z
    .enum(["draft", "submitted", "reviewed", "verified", "rejected"])
    .optional()
    .default("submitted"),
  /** GeoJSON root object or a single Feature. */
  geojson: z.unknown(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { geojson, sourceUrl, verificationStatus } = parsed.data;
  const features = parseFeaturesFromGeoRoot(geojson);
  if (!features.length) {
    return NextResponse.json({ error: "No GeoJSON features found" }, { status: 400 });
  }

  const { createdCount, settlementIds, skipped, dbAtlasReference } = await importAtlasFeatures(features, {
    sourceUrl: sourceUrl ?? null,
    verificationStatus,
  });

  return NextResponse.json({
    ok: true,
    source: ATLAS_IMPORT_SOURCE,
    created: createdCount,
    settlementIds,
    skipped,
    dbAtlasReference,
  });
}
