import type { SettlementRecord } from "@/types/settlement";

/** Parse JSON string; if the result is still a string, parse once more (double-encoded API payloads). */
function parseJsonLoose(raw: string): unknown {
  try {
    let v: unknown = JSON.parse(raw);
    if (typeof v === "string") {
      try {
        v = JSON.parse(v);
      } catch {
        // keep inner string
      }
    }
    return v;
  } catch {
    return null;
  }
}

/**
 * API / client may provide GeoJSON geometry as a JSON string or an already-parsed object.
 */
export function parseGeometryFromField(raw: unknown): GeoJSON.Geometry | null {
  if (raw == null) return null;
  if (typeof raw === "object" && raw !== null && "type" in raw) {
    return raw as GeoJSON.Geometry;
  }
  if (typeof raw === "string") {
    const v = parseJsonLoose(raw);
    if (v && typeof v === "object" && v !== null && "type" in v) {
      return v as GeoJSON.Geometry;
    }
  }
  return null;
}

/**
 * Centroid may be stored as JSON string or object (e.g. Prisma Json serialized in different shapes).
 */
export function parseCentroidFromField(raw: unknown): GeoJSON.Point | null {
  if (raw == null) return null;
  let v: unknown = raw;
  if (typeof raw === "string") {
    v = parseJsonLoose(raw);
  }
  if (v && typeof v === "object" && v !== null) {
    const p = v as GeoJSON.Point;
    if (p.type === "Point" && Array.isArray(p.coordinates) && p.coordinates.length >= 2) {
      return p;
    }
  }
  return null;
}

function centerFromPoint(p: GeoJSON.Point): [number, number] | null {
  const [lon, lat] = p.coordinates;
  if (typeof lon !== "number" || typeof lat !== "number" || !Number.isFinite(lon) || !Number.isFinite(lat)) {
    return null;
  }
  return [lat, lon];
}

export type SettlementMapMarkerItem = {
  settlement: SettlementRecord;
  isAtlas: boolean;
  /** [lat, lng] for Leaflet CircleMarker center */
  center: [number, number];
};

export type SettlementMapLayerModel = {
  polygonCollection: GeoJSON.FeatureCollection;
  markerItems: SettlementMapMarkerItem[];
  atlasPolygons: GeoJSON.Feature[];
  communityPolygons: GeoJSON.Feature[];
  atlasMarkers: SettlementMapMarkerItem[];
  communityMarkers: SettlementMapMarkerItem[];
  counts: {
    atlasPolygon: number;
    communityPolygon: number;
    atlasMarker: number;
    communityMarker: number;
  };
};

function logCommunitySamples(communitySettlements: SettlementRecord[]) {
  if (process.env.NODE_ENV !== "development") return;
  const slice = communitySettlements.slice(0, 3);
  for (const s of slice) {
    const geometry = parseGeometryFromField(s.geometry as unknown);
    const centroid = parseCentroidFromField(s.centroid as unknown);
    const hasPolygon = geometry?.type === "Polygon" || geometry?.type === "MultiPolygon";
    let hasMarkerFallback = false;
    if (!hasPolygon) {
      if (geometry?.type === "Point") {
        hasMarkerFallback = centerFromPoint(geometry as GeoJSON.Point) != null;
      }
      if (!hasMarkerFallback && centroid) {
        hasMarkerFallback = centerFromPoint(centroid) != null;
      }
    }
    console.log("[buildSettlementMapLayerModel] community sample", {
      id: s.id,
      name: s.name,
      geometryType: geometry?.type ?? null,
      centroidType: centroid?.type ?? null,
      hasPolygon,
      hasMarkerFallback,
    });
  }
}

/**
 * Single source of truth for map polygons/markers from already layer-filtered lists.
 * Parent passes visible atlas vs visible community arrays only.
 * GeoJSON coordinates stay [lon, lat]; Leaflet GeoJSON layer handles CRS. CircleMarker uses [lat, lon].
 */
export function buildSettlementMapLayerModel(
  atlasSettlements: SettlementRecord[],
  communitySettlements: SettlementRecord[],
): SettlementMapLayerModel {
  logCommunitySamples(communitySettlements);

  const polygonFeatures: GeoJSON.Feature[] = [];
  const markerItems: SettlementMapMarkerItem[] = [];
  let atlasPolygon = 0;
  let communityPolygon = 0;
  let atlasMarker = 0;
  let communityMarker = 0;

  for (const s of atlasSettlements) {
    const geometry = parseGeometryFromField(s.geometry as unknown);
    const centroid = parseCentroidFromField(s.centroid as unknown);
    const isPoly = geometry?.type === "Polygon" || geometry?.type === "MultiPolygon";
    if (isPoly && geometry) {
      polygonFeatures.push({
        type: "Feature",
        properties: {
          id: s.id,
          name: s.name,
          city: s.city,
          country: s.country,
          areaM2: s.areaM2 ?? 0,
          atlasReference: true,
        },
        geometry: geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon,
      });
      atlasPolygon += 1;
    }
    let center: [number, number] | null = null;
    if (centroid) center = centerFromPoint(centroid);
    else if (geometry?.type === "Point") center = centerFromPoint(geometry as GeoJSON.Point);
    if (center) {
      markerItems.push({ settlement: s, isAtlas: true, center });
      atlasMarker += 1;
    }
  }

  for (const s of communitySettlements) {
    const geometry = parseGeometryFromField(s.geometry as unknown);
    const centroid = parseCentroidFromField(s.centroid as unknown);
    const isPoly = geometry?.type === "Polygon" || geometry?.type === "MultiPolygon";
    if (isPoly && geometry) {
      polygonFeatures.push({
        type: "Feature",
        properties: {
          id: s.id,
          name: s.name,
          city: s.city,
          country: s.country,
          areaM2: s.areaM2 ?? 0,
          atlasReference: false,
        },
        geometry: geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon,
      });
      communityPolygon += 1;
    }
    let center: [number, number] | null = null;
    if (centroid) center = centerFromPoint(centroid);
    else if (geometry?.type === "Point") center = centerFromPoint(geometry as GeoJSON.Point);
    if (center) {
      markerItems.push({ settlement: s, isAtlas: false, center });
      communityMarker += 1;
    }
  }

  const atlasPolygons = polygonFeatures.filter((f) => f.properties?.atlasReference === true);
  const communityPolygons = polygonFeatures.filter((f) => f.properties?.atlasReference === false);
  const atlasMarkers = markerItems.filter((m) => m.isAtlas);
  const communityMarkers = markerItems.filter((m) => !m.isAtlas);

  return {
    polygonCollection: { type: "FeatureCollection", features: polygonFeatures },
    markerItems,
    atlasPolygons,
    communityPolygons,
    atlasMarkers,
    communityMarkers,
    counts: {
      atlasPolygon,
      communityPolygon,
      atlasMarker,
      communityMarker,
    },
  };
}
