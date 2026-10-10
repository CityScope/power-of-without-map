import fs from "node:fs/promises";
import { DOMParser } from "xmldom";
import { kml as toGeoJSON } from "@tmcw/togeojson";
export {};

async function main() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error("Usage: npm run import:kml -- <path-to-kml>");
  const content = await fs.readFile(filePath, "utf-8");
  const dom = new DOMParser().parseFromString(content);
  const geojson = toGeoJSON(dom);
  console.log(`Converted KML to ${geojson.features.length} features.`);
}

void main();
