import { buffer, point } from "@turf/turf";

/**
 * Settlements store Polygon or MultiPolygon. Coerce Point to a small footprint (not HDX data).
 */
export function geometryToSettlementPolygon(geometry: GeoJSON.Geometry): GeoJSON.Polygon | GeoJSON.MultiPolygon | null {
  if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
    return geometry;
  }
  if (geometry.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
    const p = point(geometry.coordinates as [number, number]);
    const b = buffer(p, 0.06, { units: "kilometers" });
    const g = b?.geometry;
    if (g && (g.type === "Polygon" || g.type === "MultiPolygon")) {
      return g;
    }
  }
  return null;
}

export function nameFromFeatureProperties(
  properties: Record<string, unknown> | null | undefined,
  index: number,
): string {
  const n = properties?.name ?? properties?.NAME ?? properties?.settlement ?? properties?.Settle;
  if (typeof n === "string" && n.trim()) {
    return n.trim().slice(0, 200);
  }
  return `Atlas feature ${index + 1}`;
}

export function textProp(properties: Record<string, unknown> | null | undefined, ...keys: string[]) {
  for (const k of keys) {
    const v = properties?.[k];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 200);
  }
  return null;
}
