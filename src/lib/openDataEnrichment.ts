import {
  area as turfArea,
  booleanIntersects,
  booleanPointInPolygon,
  point as turfPoint,
} from "@turf/turf";

export type OpenDataEnrichmentResult = {
  osm: Record<string, unknown>;
  unhabitat: Record<string, unknown>;
  beam: Record<string, unknown>;
  atlas: Record<string, unknown>;
  status: "pending" | "partial" | "ready" | "failed";
  notes: string[];
  suggestedValues: Record<string, number | string | null>;
  suggestedMeta: Record<
    string,
    {
      confidence: "high" | "medium" | "low";
      explanation: string;
      source: "open-data";
      basis: "inside" | "nearby" | "mixed";
    }
  >;
  report: {
    roadsFound: number;
    buildingsFound: number;
    servicesFound: number;
    gaps: string[];
    enrichedAt: string;
  };
};

type BBox = { minLat: number; minLon: number; maxLat: number; maxLon: number };

function flattenCoords(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): number[][] {
  if (geometry.type === "Polygon") return geometry.coordinates.flat();
  return geometry.coordinates.flat(2);
}

function getBbox(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): BBox {
  const coords = flattenCoords(geometry);
  let minLat = 90;
  let minLon = 180;
  let maxLat = -90;
  let maxLon = -180;
  for (const [lon, lat] of coords) {
    minLat = Math.min(minLat, lat);
    minLon = Math.min(minLon, lon);
    maxLat = Math.max(maxLat, lat);
    maxLon = Math.max(maxLon, lon);
  }
  return { minLat, minLon, maxLat, maxLon };
}

function qElements(body: string, bbox: BBox) {
  return `
[out:json][timeout:60];
(
${body}
);
out body geom qt;
`.replaceAll("{bbox}", `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`);
}

type OverpassElement = {
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
};

async function overpassElements(query: string): Promise<OverpassElement[]> {
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query,
  });
  if (!res.ok) throw new Error(`Overpass failed ${res.status}`);
  const json = (await res.json()) as { elements?: OverpassElement[] };
  return json.elements ?? [];
}

function expandBbox(bbox: BBox, delta = 0.01): BBox {
  return {
    minLat: bbox.minLat - delta,
    minLon: bbox.minLon - delta,
    maxLat: bbox.maxLat + delta,
    maxLon: bbox.maxLon + delta,
  };
}

function classifyElement(
  element: OverpassElement,
  settlementPolygon: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
): "inside" | "nearby" | "outside" {
  if (element.type === "node" && element.lat !== undefined && element.lon !== undefined) {
    const inside = booleanPointInPolygon(turfPoint([element.lon, element.lat]), settlementPolygon);
    return inside ? "inside" : "nearby";
  }

  if ((element.type === "way" || element.type === "relation") && element.geometry?.length) {
    const coords = element.geometry.map((g) => [g.lon, g.lat]) as [number, number][];
    if (coords.length < 2) return "outside";
    const isClosed = coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1];
    const geom: GeoJSON.Geometry = isClosed && coords.length >= 4 ? { type: "Polygon", coordinates: [coords] } : { type: "LineString", coordinates: coords };
    const intersects = booleanIntersects({ type: "Feature", geometry: geom, properties: {} }, settlementPolygon);
    return intersects ? "inside" : "nearby";
  }

  return "outside";
}

export async function enrichFromOverpass(geojsonPolygon: GeoJSON.Polygon | GeoJSON.MultiPolygon) {
  const bbox = getBbox(geojsonPolygon);
  const nearbyBbox = expandBbox(bbox, 0.015);
  const settlementFeature = { type: "Feature", geometry: geojsonPolygon, properties: {} } as GeoJSON.Feature<
    GeoJSON.Polygon | GeoJSON.MultiPolygon
  >;
  const areaKm2 = turfArea(settlementFeature) / 1_000_000;

  const queries = {
    roads: qElements('way["highway"]({bbox});', nearbyBbox),
    pavedRoads: qElements('way["highway"]["surface"~"asphalt|concrete|paved"]({bbox});', nearbyBbox),
    transportStops: qElements('node["public_transport"~"platform|stop_position"]({bbox});node["highway"="bus_stop"]({bbox});', nearbyBbox),
    schools: qElements('node["amenity"="school"]({bbox});way["amenity"="school"]({bbox});', nearbyBbox),
    healthFacilities: qElements('node["amenity"~"hospital|clinic|doctors"]({bbox});way["amenity"~"hospital|clinic|doctors"]({bbox});', nearbyBbox),
    waterPoints: qElements('node["amenity"="drinking_water"]({bbox});node["man_made"="water_well"]({bbox});', nearbyBbox),
    sanitation: qElements('node["amenity"="toilets"]({bbox});way["amenity"="toilets"]({bbox});', nearbyBbox),
    streetlights: qElements('node["highway"="street_lamp"]({bbox});', nearbyBbox),
    buildings: qElements('way["building"]({bbox});relation["building"]({bbox});', nearbyBbox),
    rivers: qElements('way["waterway"~"river|stream|canal"]({bbox});', nearbyBbox),
    coast: qElements('way["natural"="coastline"]({bbox});', nearbyBbox),
    railway: qElements('way["railway"]({bbox});', nearbyBbox),
    industrial: qElements('way["landuse"="industrial"]({bbox});relation["landuse"="industrial"]({bbox});', nearbyBbox),
  };
  const entries = await Promise.all(Object.entries(queries).map(async ([k, q]) => [k, await overpassElements(q)]));
  const featureBuckets = Object.fromEntries(entries) as Record<string, OverpassElement[]>;

  const counts = Object.fromEntries(
    Object.entries(featureBuckets).map(([k, elements]) => {
      let inside = 0;
      let nearby = 0;
      for (const element of elements) {
        const cls = classifyElement(element, settlementFeature);
        if (cls === "inside") inside++;
        if (cls === "nearby") nearby++;
      }
      return [k, { inside, nearby, total: inside + nearby }];
    }),
  );

  const roadsTagged = featureBuckets.roads?.filter((r) => Boolean(r.tags?.surface)).length ?? 0;
  const roadTagQuality = (featureBuckets.roads?.length ?? 0) > 0 ? roadsTagged / (featureBuckets.roads?.length ?? 1) : 0;

  return {
    counts,
    bbox,
    nearbyBbox,
    roadTagQuality,
    areaKm2,
    enrichedAt: new Date().toISOString(),
  };
}

export async function enrichFromUNHabitat(_country?: string, _city?: string) {
  void _country;
  void _city;
  return {
    indicators: null,
    source: "UN-Habitat data connector placeholder",
    url: "https://data.unhabitat.org/pages/housing-slums-and-informal-settlements",
  };
}

export async function enrichFromBeam() {
  return {
    source: "BEAM/UNITAC placeholder",
    indicators: null,
    note: "No public API endpoint configured yet.",
  };
}

export async function enrichFromAtlasImporter() {
  return {
    source: "Atlas importer placeholder",
    indicators: null,
    note: "Use manual CSV/GeoJSON/KML upload until official endpoint is available.",
  };
}

export async function runOpenDataEnrichment(
  polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  country?: string,
  city?: string,
): Promise<OpenDataEnrichmentResult> {
  const [osm, unhabitat, beam, atlas] = await Promise.all([
    enrichFromOverpass(polygon),
    enrichFromUNHabitat(country, city),
    enrichFromBeam(),
    enrichFromAtlasImporter(),
  ]);

  const osmCounts = osm as {
    counts: Record<string, { inside: number; nearby: number; total: number }>;
    enrichedAt?: string;
  };
  const bucket = (name: string) =>
    (osmCounts.counts as Record<string, { inside: number; nearby: number; total: number }>)[name] ?? {
      inside: 0,
      nearby: 0,
      total: 0,
    };
  const suggestedValues: Record<string, number | string | null> = {
    mobilitySatisfaction: Math.min(1, (bucket("transportStops").inside + 0.5 * bucket("transportStops").nearby) / 20),
    connectivitySatisfaction: Math.min(1, (bucket("roads").inside + 0.5 * bucket("roads").nearby) / 40),
    sanitationSatisfaction: Math.min(1, (bucket("sanitation").inside + 0.5 * bucket("sanitation").nearby) / 10),
    waterSatisfaction: Math.min(1, (bucket("waterPoints").inside + 0.5 * bucket("waterPoints").nearby) / 10),
    structureDevelopmentScore: Math.min(1, (bucket("buildings").inside + 0.4 * bucket("buildings").nearby) / 200),
    inferredRoadSurface: bucket("pavedRoads").inside > 0 ? "paved/cement" : bucket("roads").inside > 0 ? "mixed" : "unknown",
    climateVulnerability: bucket("rivers").inside + bucket("coast").inside > 0 ? "flood,coastal risk" : "unknown",
  };
  const report = {
    roadsFound: bucket("roads").inside,
    buildingsFound: bucket("buildings").inside,
    servicesFound:
      bucket("schools").inside +
      bucket("healthFacilities").inside +
      bucket("waterPoints").inside +
      bucket("sanitation").inside +
      bucket("transportStops").inside,
    gaps: [
      bucket("schools").inside === 0 ? "No schools mapped inside polygon" : "",
      bucket("healthFacilities").inside === 0 ? "No health facilities mapped inside polygon" : "",
      bucket("waterPoints").inside === 0 ? "No water points mapped inside polygon" : "",
      bucket("sanitation").inside === 0 ? "No sanitation mapped inside polygon" : "",
      bucket("streetlights").inside === 0 ? "No streetlights mapped inside polygon" : "",
    ].filter(Boolean),
    enrichedAt: String(osmCounts.enrichedAt ?? new Date().toISOString()),
  };
  type SuggestionMeta = {
    confidence: "high" | "medium" | "low";
    explanation: string;
    source: "open-data";
    basis: "inside" | "nearby" | "mixed";
  };
  const metaFromCounts = (k: string, countName: string) => {
    const c = bucket(countName);
    const basis: "inside" | "nearby" | "mixed" =
      c.inside > 0 && c.nearby > 0 ? "mixed" : c.inside > 0 ? "inside" : "nearby";
    const confidence: "high" | "medium" | "low" =
      c.inside >= 5 ? "high" : c.inside + c.nearby >= 3 ? "medium" : "low";
    return {
      confidence,
      explanation: `${c.inside} features inside/intersect polygon, ${c.nearby} nearby in envelope.`,
      source: "open-data" as const,
      basis,
    };
  };
  const finalMeta: Record<string, SuggestionMeta> = {
    mobilitySatisfaction: metaFromCounts("mobilitySatisfaction", "transportStops"),
    connectivitySatisfaction: metaFromCounts("connectivitySatisfaction", "roads"),
    sanitationSatisfaction: metaFromCounts("sanitationSatisfaction", "sanitation"),
    waterSatisfaction: metaFromCounts("waterSatisfaction", "waterPoints"),
    structureDevelopmentScore: metaFromCounts("structureDevelopmentScore", "buildings"),
    inferredRoadSurface: metaFromCounts("inferredRoadSurface", "pavedRoads"),
    climateVulnerability: metaFromCounts("climateVulnerability", "rivers"),
  };

  return {
    osm,
    unhabitat,
    beam,
    atlas,
    status: "partial",
    notes: ["OSM features fetched by bbox envelope and filtered with Turf against settlement polygon."],
    suggestedValues,
    suggestedMeta: finalMeta,
    report,
  };
}
