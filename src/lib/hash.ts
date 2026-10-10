import { createHash } from "node:crypto";

export function hashGeometry(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): string {
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex");
}
