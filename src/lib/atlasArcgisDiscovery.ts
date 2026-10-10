const APP_ITEM_ID = "b778c386e2d54a0e9bbdc3b08c21abd6";

export const ATLAS_ARCGIS_APP_ITEM_URL = `https://www.arcgis.com/sharing/rest/content/items/${APP_ITEM_ID}?f=json`;
export const ATLAS_ARCGIS_APP_DATA_URL = `https://www.arcgis.com/sharing/rest/content/items/${APP_ITEM_ID}/data?f=json`;
export const ATLAS_SOURCE_URL = "https://www.atlasofinformality.com/";

/** Web Mercator x/y in meters → WGS84 [lon, lat] in degrees. ArcGIS uses x = easting, y = northing. */
const WEB_MERCATOR_RANGE = 20037508.34;

export function webMercatorXYToWgs84LonLat(x: number, y: number): [number, number] {
  const lon = (x / WEB_MERCATOR_RANGE) * 180;
  const lat0 = (y / WEB_MERCATOR_RANGE) * 180;
  const lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat0 * Math.PI) / 180)) - Math.PI / 2);
  return [lon, lat];
}

function isWgs84Range(lon: number, lat: number): boolean {
  return (
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

type ArcgisLayerInfo = {
  id?: string;
  title?: string;
  url?: string;
  itemId?: string;
};

type ArcgisGeo = {
  x?: number;
  y?: number;
  rings?: number[][][];
  paths?: number[][][];
  spatialReference?: { wkid?: number; latestWkid?: number };
};

type ArcgisFeatureSet = {
  features?: Array<{
    attributes?: Record<string, unknown>;
    geometry?: ArcgisGeo;
  }>;
};

function getWkidFromSpatialReference(
  sr: { wkid?: number; latestWkid?: number } | undefined,
  fallback: number | undefined,
): number | undefined {
  if (!sr) return fallback;
  return sr.wkid ?? sr.latestWkid ?? fallback;
}

function isWebMercatorWkid(wkid: number | undefined): boolean {
  if (wkid == null) return false;
  return wkid === 3857 || wkid === 102100 || wkid === 900913;
}

/**
 * Reproject a single [x, y] from ArcGIS (same axis order as output GeoJSON) to WGS84 lon/lat.
 */
function pairToWgs84(
  x: number,
  y: number,
  wkid: number | undefined,
): { lon: number; lat: number } {
  if (isWebMercatorWkid(wkid)) {
    const [lon, lat] = webMercatorXYToWgs84LonLat(x, y);
    return { lon, lat };
  }
  /* Geographic / unknown: use x=lon, y=lat in degrees (ArcGIS contract). */
  return { lon: x, lat: y };
}

function tryInferMercatorIfGeographicInvalid(
  x: number,
  y: number,
  wkid: number | undefined,
): { lon: number; lat: number; inferred3857: boolean } {
  const first = pairToWgs84(x, y, wkid);
  if (isWgs84Range(first.lon, first.lat)) {
    return { lon: first.lon, lat: first.lat, inferred3857: false };
  }
  if (wkid == null && (Math.abs(x) > 360 || Math.abs(y) > 90 || Math.abs(x) > 1e6 || Math.abs(y) > 1e6)) {
    const [lon, lat] = webMercatorXYToWgs84LonLat(x, y);
    if (isWgs84Range(lon, lat)) {
      return { lon, lat, inferred3857: true };
    }
  }
  return { lon: first.lon, lat: first.lat, inferred3857: false };
}

function toGeoFeature(
  f: { attributes?: Record<string, unknown>; geometry?: ArcgisGeo | undefined },
  options: {
    defaultWkid?: number;
    onInvalid?: (message: string) => void;
  } = {},
): GeoJSON.Feature | null {
  const g = f.geometry;
  if (!g) return null;
  const geomSr = g.spatialReference;
  const wkid = getWkidFromSpatialReference(geomSr, options.defaultWkid);

  if (typeof g.x === "number" && typeof g.y === "number") {
    const { lon, lat, inferred3857 } = tryInferMercatorIfGeographicInvalid(g.x, g.y, wkid);
    if (inferred3857) {
      console.warn(
        "[atlas ArcGIS] Inferred Web Mercator (wkid) for point; set explicit spatialReference when possible.",
      );
    }
    if (!isWgs84Range(lon, lat)) {
      const msg = `[atlas ArcGIS] Skipping point: invalid WGS84 lon/lat after conversion (${lon}, ${lat}), raw x,y=${g.x},${g.y} wkid=${String(wkid)}`;
      console.warn(msg);
      options.onInvalid?.(msg);
      return null;
    }
    return {
      type: "Feature",
      properties: f.attributes ?? {},
      geometry: { type: "Point", coordinates: [lon, lat] },
    };
  }
  if (Array.isArray(g.rings) && g.rings.length) {
    const ringWkid = wkid;
    const newRings: number[][][] = [];
    for (const ring of g.rings) {
      if (!Array.isArray(ring) || !ring.length) continue;
      const newRing: number[][] = [];
      for (const pt of ring) {
        if (!Array.isArray(pt) || pt.length < 2) continue;
        const [x, y] = pt as [number, number];
        const { lon, lat } = tryInferMercatorIfGeographicInvalid(x, y, ringWkid);
        if (!isWgs84Range(lon, lat)) {
          const msg = `[atlas ArcGIS] Skipping polygon: invalid WGS84 vertex (${lon}, ${lat}) wkid=${String(ringWkid)}`;
          console.warn(msg);
          options.onInvalid?.(msg);
          return null;
        }
        newRing.push([lon, lat]);
      }
      if (newRing.length) newRings.push(newRing);
    }
    if (!newRings.length) return null;
    return {
      type: "Feature",
      properties: f.attributes ?? {},
      geometry: { type: "Polygon", coordinates: newRings },
    };
  }
  if (Array.isArray(g.paths) && g.paths.length) {
    const pathWkid = wkid;
    const newPaths: number[][][] = [];
    for (const path of g.paths) {
      if (!Array.isArray(path) || !path.length) continue;
      const newPath: number[][] = [];
      for (const pt of path) {
        if (!Array.isArray(pt) || pt.length < 2) continue;
        const [x, y] = pt as [number, number];
        const { lon, lat } = tryInferMercatorIfGeographicInvalid(x, y, pathWkid);
        if (!isWgs84Range(lon, lat)) {
          const msg = `[atlas ArcGIS] Skipping line: invalid WGS84 vertex (${lon}, ${lat}) wkid=${String(pathWkid)}`;
          console.warn(msg);
          options.onInvalid?.(msg);
          return null;
        }
        newPath.push([lon, lat]);
      }
      if (newPath.length) newPaths.push(newPath);
    }
    if (!newPaths.length) return null;
    return {
      type: "Feature",
      properties: f.attributes ?? {},
      geometry: { type: "MultiLineString", coordinates: newPaths },
    };
  }
  return null;
}

function toFeatureCollectionLayerFeatures(layer: Record<string, unknown>) {
  const fs = (layer.featureSet ?? {}) as ArcgisFeatureSet;
  return fs.features ?? [];
}

function wkidFromLayer(lyr: Record<string, unknown>): number | undefined {
  const def = lyr.layerDefinition as { spatialReference?: { wkid?: number; latestWkid?: number } } | undefined;
  return getWkidFromSpatialReference(def?.spatialReference, undefined);
}

async function getJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Request failed ${res.status} at ${url}`);
  return (await res.json()) as Record<string, unknown>;
}

export type AtlasArcgisDiscoveryResult = {
  appItemFound: boolean;
  appItemId: string;
  webmapId: string | null;
  appItemUrl: string;
  appDataUrl: string;
  webmapItemUrl: string | null;
  webmapDataUrl: string | null;
  appType: string | null;
  webmapType: string | null;
  operationalLayers: ArcgisLayerInfo[];
  layerItemIds: string[];
  featureServerUrls: string[];
  mapServerUrls: string[];
  downloadableResources: string[];
  importableRecordsCount: number;
  importableFeatureCollections: GeoJSON.Feature[][];
  probedFeatureServiceLayers: string[];
  notes: string[];
  /** Features dropped during esri → GeoJSON conversion (out-of-range WGS84, etc.) */
  invalidGeometrySkips: number;
};

async function probeFeatureLayer(layerUrl: string) {
  const qGeo = `${layerUrl}/0/query?where=1%3D1&outFields=*&f=geojson`;
  const qJson = `${layerUrl}/0/query?where=1%3D1&outFields=*&returnGeometry=true&f=json`;
  let invalidCount = 0;
  const onInvalid = () => {
    invalidCount += 1;
  };
  try {
    const geo = await getJson(qGeo);
    const fc = geo as unknown as { type?: string; features?: GeoJSON.Feature[]; crs?: { properties?: { name?: string } } };
    if (fc.type === "FeatureCollection" && Array.isArray(fc.features) && fc.features.length) {
      return { features: fc.features, invalidSkips: 0 as number };
    }
  } catch {
    // fall back below
  }
  try {
    const raw = await getJson(qJson);
    const rootSr = raw.spatialReference as { wkid?: number; latestWkid?: number } | undefined;
    const defaultWkid = getWkidFromSpatialReference(rootSr, undefined);
    const list = (raw.features as Record<string, unknown>[] | undefined) ?? [];
    const out: GeoJSON.Feature[] = [];
    for (const f of list) {
      const feat = toGeoFeature(
        {
          attributes: (f.attributes as Record<string, unknown> | undefined) ?? {},
          geometry: (f.geometry as ArcgisGeo | undefined) ?? undefined,
        },
        { defaultWkid, onInvalid },
      );
      if (feat) out.push(feat);
    }
    return { features: out, invalidSkips: invalidCount };
  } catch {
    return { features: [] as GeoJSON.Feature[], invalidSkips: 0 };
  }
}

export async function discoverAtlasArcgisLayers(): Promise<AtlasArcgisDiscoveryResult> {
  const notes: string[] = [];
  let appMeta: Record<string, unknown> | null = null;
  let appData: Record<string, unknown> | null = null;
  let webmapMeta: Record<string, unknown> | null = null;
  let webmapData: Record<string, unknown> | null = null;
  let webmapId: string | null = null;
  let invalidGeometrySkips = 0;

  try {
    appMeta = await getJson(ATLAS_ARCGIS_APP_ITEM_URL);
    appData = await getJson(ATLAS_ARCGIS_APP_DATA_URL);
    webmapId = (appData.values as { webmap?: string } | undefined)?.webmap ?? null;
  } catch (e) {
    notes.push(e instanceof Error ? e.message : "Failed to fetch ArcGIS app metadata.");
  }

  if (webmapId) {
    try {
      const wmItemUrl = `https://www.arcgis.com/sharing/rest/content/items/${webmapId}?f=json`;
      const wmDataUrl = `https://www.arcgis.com/sharing/rest/content/items/${webmapId}/data?f=json`;
      webmapMeta = await getJson(wmItemUrl);
      webmapData = await getJson(wmDataUrl);
    } catch (e) {
      notes.push(e instanceof Error ? e.message : "Failed to fetch ArcGIS webmap metadata/data.");
    }
  } else {
    notes.push("No webmap id found in app data values.webmap.");
  }

  const operationalLayers = ((webmapData?.operationalLayers as Record<string, unknown>[] | undefined) ?? []).map((l) => ({
    id: typeof l.id === "string" ? l.id : undefined,
    title: typeof l.title === "string" ? l.title : undefined,
    url: typeof l.url === "string" ? l.url : undefined,
    itemId: typeof l.itemId === "string" ? l.itemId : undefined,
  }));
  const layerItemIds = operationalLayers.map((l) => l.itemId).filter((v): v is string => Boolean(v));
  const featureServerUrls = operationalLayers
    .map((l) => l.url)
    .filter((v): v is string => typeof v === "string" && v.toLowerCase().includes("featureserver"));
  const mapServerUrls = operationalLayers
    .map((l) => l.url)
    .filter((v): v is string => typeof v === "string" && v.toLowerCase().includes("mapserver"));

  const importableFeatureCollections: GeoJSON.Feature[][] = [];
  const probedFeatureServiceLayers: string[] = [];
  for (const layer of (webmapData?.operationalLayers as Record<string, unknown>[] | undefined) ?? []) {
    const fc = layer.featureCollection as { layers?: Record<string, unknown>[] } | undefined;
    if (!fc?.layers?.length) continue;
    for (const lyr of fc.layers) {
      const rawFeatures = toFeatureCollectionLayerFeatures(lyr);
      if (!rawFeatures.length) continue;
      const layerWkid = wkidFromLayer(lyr);
      let localInvalid = 0;
      const onInvalid = () => {
        localInvalid += 1;
      };
      const converted = rawFeatures
        .map((f) => toGeoFeature(f, { defaultWkid: layerWkid, onInvalid }))
        .filter((f): f is GeoJSON.Feature => Boolean(f));
      invalidGeometrySkips += localInvalid;
      if (converted.length) importableFeatureCollections.push(converted);
    }
  }
  for (const fsUrl of featureServerUrls) {
    const { features, invalidSkips } = await probeFeatureLayer(fsUrl);
    invalidGeometrySkips += invalidSkips;
    if (features.length) {
      probedFeatureServiceLayers.push(`${fsUrl}/0`);
      importableFeatureCollections.push(features);
    }
  }
  const importableRecordsCountWithServices = importableFeatureCollections.reduce((sum, arr) => sum + arr.length, 0);

  if (!featureServerUrls.length && !mapServerUrls.length) {
    notes.push("No public FeatureServer/MapServer URL found; layers may be embedded webmap feature collections.");
  }
  if (!importableRecordsCountWithServices) {
    notes.push("No importable features detected from public webmap data.");
  }

  return {
    appItemFound: Boolean(appMeta && appMeta.id === APP_ITEM_ID),
    appItemId: APP_ITEM_ID,
    webmapId,
    appItemUrl: ATLAS_ARCGIS_APP_ITEM_URL,
    appDataUrl: ATLAS_ARCGIS_APP_DATA_URL,
    webmapItemUrl: webmapId ? `https://www.arcgis.com/sharing/rest/content/items/${webmapId}?f=json` : null,
    webmapDataUrl: webmapId ? `https://www.arcgis.com/sharing/rest/content/items/${webmapId}/data?f=json` : null,
    appType: (appMeta?.type as string | undefined) ?? null,
    webmapType: (webmapMeta?.type as string | undefined) ?? null,
    operationalLayers,
    layerItemIds,
    featureServerUrls,
    mapServerUrls,
    downloadableResources: operationalLayers
      .map((l) => l.url)
      .filter((u): u is string => typeof u === "string" && /\.(csv|geojson|kml|kmz|zip)$/i.test(u)),
    importableRecordsCount: importableRecordsCountWithServices,
    importableFeatureCollections,
    probedFeatureServiceLayers,
    notes,
    invalidGeometrySkips: invalidGeometrySkips,
  };
}
