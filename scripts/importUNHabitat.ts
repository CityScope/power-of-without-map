export {};
import fs from "node:fs/promises";
import { parseUNHabitatInput } from "../src/lib/unhabitatImporter";

async function main() {
  const format = (process.argv[2] ?? "geojson") as "csv" | "geojson" | "kml" | "shapefile" | "featureserver";
  const source = process.argv[3];
  if (!source) {
    console.log("Usage: npm run import:unhabitat -- <format> <path-or-url>");
    return;
  }
  const input =
    format === "featureserver" || format === "shapefile"
      ? { format, url: source }
      : { format, content: await fs.readFile(source, "utf-8") };
  const features = await parseUNHabitatInput(input);
  console.log(`Parsed ${features.length} features from UN-Habitat source.`);
  console.log("Post to /api/import/unhabitat for ingestion.");
}

void main();
