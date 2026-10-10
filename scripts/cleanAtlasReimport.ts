/**
 * One-shot: delete Atlas reference settlements (cascades survey/scores/enrichment/audit),
 * re-run the same logic as POST /api/data-sources/atlas-arcgis-discover, print report.
 *
 * Usage: npx tsx scripts/cleanAtlasReimport.ts
 * Requires: DATABASE_URL, network for ArcGIS
 */
import { ATLAS_SOURCE_URL, discoverAtlasArcgisLayers } from "../src/lib/atlasArcgisDiscovery";
import { importAtlasFeatures } from "../src/lib/atlasImportRun";
import { prisma } from "../src/lib/prisma";

function parseCentroid(centroidJson: string): { lon: number; lat: number } | null {
  try {
    const c = JSON.parse(centroidJson) as GeoJSON.Point;
    if (c.type === "Point" && Array.isArray(c.coordinates) && c.coordinates.length >= 2) {
      return { lon: c.coordinates[0], lat: c.coordinates[1] };
    }
  } catch {
    // ignore
  }
  return null;
}

/** Loose WGS84 boxes for spot-checks (minLon, minLat, maxLon, maxLat) */
const SPOT_REGIONS: { label: string; re: RegExp; box: [number, number, number, number] }[] = [
  { label: "Kenya (Nairobi/Kibera area)", re: /nairobi|kibera|kenya/i, box: [32, -5, 43, 5] },
  { label: "India (Mumbai/Dharavi area)", re: /mumbai|dharavi|bombay|maharashtra/i, box: [68, 6, 78, 22] },
  /* Wider than metro Cape Town: includes other SA reference points that only set country=South Africa */
  { label: "South Africa (incl. Cape Town & other metros)", re: /cape town|western cape|durban|johannesburg|gauteng|pretoria|south africa/i, box: [16, -35, 33, -22] },
];

function inBox(lon: number, lat: number, box: [number, number, number, number]) {
  const [minLon, minLat, maxLon, maxLat] = box;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

async function main() {
  const ctxBefore = await prisma.contextualIndicator.count();
  const communityBefore = await prisma.settlement.count({ where: { atlasReference: false } });
  const atlasBefore = await prisma.settlement.count({ where: { atlasReference: true } });

  console.log("=== Before ===");
  console.log(`ContextualIndicator rows: ${ctxBefore} (unchanged by this script)`);
  console.log(`Community settlements (atlasReference=false): ${communityBefore}`);
  console.log(`Atlas reference settlements to delete: ${atlasBefore}`);

  const deleted = await prisma.settlement.deleteMany({ where: { atlasReference: true } });
  console.log(`\nDeleted Atlas reference settlements: ${deleted.count} (cascade: survey, scores, enrichment, audit)`);

  const discovered = await discoverAtlasArcgisLayers();
  let imported = 0;
  const importSkipped: string[] = [];
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
      importSkipped.push(...res.skipped);
    }
  }

  const [atlasTrue, atlasFalse] = await Promise.all([
    prisma.settlement.count({ where: { atlasReference: true } }),
    prisma.settlement.count({ where: { atlasReference: false } }),
  ]);

  const first10 = await prisma.settlement.findMany({
    where: { atlasReference: true },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: { name: true, city: true, country: true, centroid: true },
  });

  const allAtlas = await prisma.settlement.findMany({
    where: { atlasReference: true },
    select: { name: true, city: true, country: true, centroid: true },
  });

  let badLon = 0;
  let badLat = 0;
  const nullIsland: string[] = [];
  for (const r of allAtlas) {
    const p = parseCentroid(r.centroid);
    if (!p) continue;
    if (p.lon < -180 || p.lon > 180) badLon += 1;
    if (p.lat < -90 || p.lat > 90) badLat += 1;
    if (Math.abs(p.lon) < 2.5 && Math.abs(p.lat) < 2.5) {
      nullIsland.push(r.name);
    }
  }

  console.log("\n=== Import result (same as POST /api/data-sources/atlas-arcgis-discover) ===");
  console.log(`Atlas records imported (this run): ${imported}`);
  console.log(`invalidGeometrySkips (discovery): ${discovered.invalidGeometrySkips}`);
  if (importSkipped.length) {
    console.log(`Import pipeline skipped (${importSkipped.length}):`);
    for (const s of importSkipped.slice(0, 20)) console.log(`  - ${s}`);
    if (importSkipped.length > 20) console.log(`  ... and ${importSkipped.length - 20} more`);
  }
  console.log(`\n=== DB after ===`);
  console.log(`atlasReference true count:  ${atlasTrue}`);
  console.log(`atlasReference false count: ${atlasFalse}`);
  console.log(`ContextualIndicator rows: ${await prisma.contextualIndicator.count()} (should match ${ctxBefore})`);

  console.log("\n=== First 10 Atlas records (name | city, country | lon, lat) ===");
  for (const r of first10) {
    const p = parseCentroid(r.centroid);
    const loc = [r.city, r.country].filter(Boolean).join(", ");
    const coord = p ? `${p.lon.toFixed(5)}, ${p.lat.toFixed(5)}` : "(invalid centroid JSON)";
    console.log(`- ${r.name} | ${loc || "—"} | ${coord}`);
  }

  console.log("\n=== Coordinate sanity ===");
  console.log(
    allAtlas.length
      ? `Centroids with lon outside [-180,180]: ${badLon} / ${allAtlas.length}; lat outside [-90,90]: ${badLat} / ${allAtlas.length}`
      : "No Atlas records to validate.",
  );
  if (nullIsland.length) {
    console.log(`Near-null-island (|lon|&|lat| < 2.5°) — review (${nullIsland.length}): ${nullIsland.slice(0, 8).join("; ")}${nullIsland.length > 8 ? "…" : ""}`);
  } else {
    console.log("No points in the “null island” box (|lon|&|lat| < 2.5°).");
  }

  console.log("\n=== Spot checks (name/city/country text vs rough region) ===");
  for (const spot of SPOT_REGIONS) {
    const matches = allAtlas.filter(
      (a) => spot.re.test(a.name) || spot.re.test(a.city ?? "") || spot.re.test(a.country ?? ""),
    );
    for (const m of matches) {
      const p = parseCentroid(m.centroid);
      if (!p) {
        console.log(`- ${spot.label} — “${m.name}”: no centroid`);
        continue;
      }
      const ok = inBox(p.lon, p.lat, spot.box);
      console.log(
        ok
          ? `- OK ${spot.label} — “${m.name}”: [${p.lon.toFixed(3)}, ${p.lat.toFixed(3)}]`
          : `- CHECK ${spot.label} — “${m.name}”: [${p.lon.toFixed(3)}, ${p.lat.toFixed(3)}] (outside expected box)`,
      );
    }
    if (matches.length === 0) {
      console.log(`- (no records matched text for: ${spot.label})`);
    }
  }

  console.log("\n=== Layer rules (app) ===");
  console.log("Atlas / reference: settlements with atlasReference === true");
  console.log("Community: settlements with atlasReference !== true (false or undefined from API still counts as community-only layer)");

  await prisma.$disconnect();
}

void main().catch((e) => {
  console.error(e);
  void prisma.$disconnect();
  process.exit(1);
});
