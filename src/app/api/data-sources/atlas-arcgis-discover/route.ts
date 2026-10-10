import { NextResponse } from "next/server";
import { ATLAS_SOURCE_URL, discoverAtlasArcgisLayers } from "@/lib/atlasArcgisDiscovery";
import { importAtlasFeatures } from "@/lib/atlasImportRun";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const discovered = await discoverAtlasArcgisLayers();

    let imported = 0;
    let importSkipped: string[] = [];
    let lastDbAtlasReference: { true: number; false: number } | null = null;
    if (discovered.importableRecordsCount > 0) {
      for (const featureList of discovered.importableFeatureCollections) {
        const res = await importAtlasFeatures(featureList, {
          source: "Atlas of Informality",
          sourceUrl: ATLAS_SOURCE_URL,
          createdBy: "atlas-arcgis-import",
          verificationStatus: "reviewed",
          notes: "Imported from public Atlas of Informality ArcGIS layer. Questionnaire KPI data not yet available.",
          auditAction: "import_atlas_arcgis_public_layer",
        });
        imported += res.createdCount;
        importSkipped = [...importSkipped, ...res.skipped];
        lastDbAtlasReference = res.dbAtlasReference;
      }
    } else {
      const [t, f] = await Promise.all([
        prisma.settlement.count({ where: { atlasReference: true } }),
        prisma.settlement.count({ where: { atlasReference: false } }),
      ]);
      lastDbAtlasReference = { true: t, false: f };
    }

    return NextResponse.json({
      ok: true,
      appItemFound: discovered.appItemFound,
      webmapId: discovered.webmapId,
      layersFound: discovered.operationalLayers.length,
      featureServicesFound: discovered.featureServerUrls.length,
      mapServicesFound: discovered.mapServerUrls.length,
      layerItemIds: discovered.layerItemIds,
      featureServerUrls: discovered.featureServerUrls,
      mapServerUrls: discovered.mapServerUrls,
      downloadableResources: discovered.downloadableResources,
      probedFeatureServiceLayers: discovered.probedFeatureServiceLayers,
      importableRecordsCount: discovered.importableRecordsCount,
      invalidGeometrySkips: discovered.invalidGeometrySkips,
      importedRecords: imported,
      importSkipped,
      dbAtlasReference: lastDbAtlasReference,
      notes: discovered.notes,
      noPublicLayerMessage:
        !discovered.importableRecordsCount && !discovered.featureServerUrls.length && !discovered.mapServerUrls.length
          ? "Atlas ArcGIS app found, but no public downloadable data layer was exposed. Please upload GeoJSON, KML/KMZ, Shapefile ZIP, CSV, or provide a FeatureServer URL."
          : null,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to discover Atlas ArcGIS layers." },
      { status: 500 },
    );
  }
}
