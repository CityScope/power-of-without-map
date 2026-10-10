import area from "@turf/area";
import centroid from "@turf/centroid";

export function calculateAreaM2(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): number {
  return area({ type: "Feature", properties: {}, geometry });
}

export function calculateCentroid(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): GeoJSON.Point {
  const c = centroid({ type: "Feature", properties: {}, geometry });
  return c.geometry;
}

export function toAreaUnits(areaM2: number) {
  return {
    m2: areaM2,
    hectares: areaM2 / 10000,
    km2: areaM2 / 1_000_000,
  };
}
