import { readFile } from "fs/promises";
import {
  importAtlasFeatures,
  parseFeaturesFromGeoRoot,
} from "../src/lib/atlasImportRun";
import { prisma } from "../src/lib/prisma";

const path = process.argv[2];
const sourceUrl = process.argv[3] ? String(process.argv[3]) : null;

async function main() {
  if (!path) {
    console.error("Usage: npm run import:atlas -- <file.geojson> [sourceUrl]");
    process.exit(1);
  }
  const raw = await readFile(path, "utf-8");
  const root = JSON.parse(raw) as unknown;
  const features = parseFeaturesFromGeoRoot(root);
  if (!features.length) {
    console.error("No GeoJSON features in file.");
    process.exit(1);
  }
  const { createdCount, settlementIds, skipped, dbAtlasReference } = await importAtlasFeatures(features, { sourceUrl });
  console.log(`Imported ${createdCount} Atlas reference settlement(s).`);
  console.log(
    `DB verification — atlasReference=true: ${dbAtlasReference.true}, atlasReference=false: ${dbAtlasReference.false}`,
  );
  if (settlementIds.length) console.log("IDs:", settlementIds.join(", "));
  if (skipped.length) {
    console.log("Skipped:");
    for (const s of skipped) console.log("  ", s);
  }
}

void main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
