import fs from "node:fs/promises";
import path from "node:path";
export {};

async function main() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error("Usage: npm run import:geojson -- <path-to-geojson>");
  const content = await fs.readFile(path.resolve(filePath), "utf-8");
  const json = JSON.parse(content) as GeoJSON.FeatureCollection;
  const records = json.features.filter((f) => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon");
  console.log(`Found ${records.length} polygon features. Use /api/settlements to insert records.`);
}

void main();
