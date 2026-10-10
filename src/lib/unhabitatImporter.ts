import Papa from "papaparse";
import { DOMParser } from "xmldom";
import { kml as toGeoJSON } from "@tmcw/togeojson";
import * as shp from "shapefile";

type GenericRecord = Record<string, unknown>;

function detectGeometry(record: GenericRecord): GeoJSON.Geometry | null {
  if (record.geometry && typeof record.geometry === "object") return record.geometry as GeoJSON.Geometry;
  if (typeof record.wkt === "string" || typeof record.WKT === "string") return null;
  const lat = Number(record.lat ?? record.latitude ?? record.y);
  const lon = Number(record.lon ?? record.lng ?? record.longitude ?? record.x);
  if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
    return { type: "Point", coordinates: [lon, lat] };
  }
  return null;
}

export async function parseUNHabitatInput(input: {
  format: "csv" | "geojson" | "kml" | "shapefile" | "featureserver";
  content?: string;
  url?: string;
}) {
  if (input.format === "geojson") {
    const parsed = JSON.parse(input.content ?? "{}") as GeoJSON.FeatureCollection;
    return parsed.features;
  }
  if (input.format === "csv") {
    const parsed = Papa.parse<GenericRecord>(input.content ?? "", { header: true, skipEmptyLines: true });
    return parsed.data
      .map((row) => ({
        type: "Feature",
        properties: row,
        geometry: detectGeometry(row),
      }))
      .filter((feature) => feature.geometry !== null);
  }
  if (input.format === "featureserver" && input.url) {
    const url = input.url.includes("?")
      ? `${input.url}&where=1%3D1&outFields=*&f=geojson`
      : `${input.url}/query?where=1%3D1&outFields=*&f=geojson`;
    const res = await fetch(url);
    const json = (await res.json()) as GeoJSON.FeatureCollection;
    return json.features ?? [];
  }
  if (input.format === "kml") {
    const dom = new DOMParser().parseFromString(input.content ?? "");
    const geojson = toGeoJSON(dom);
    return geojson.features ?? [];
  }
  if (input.format === "shapefile" && input.url) {
    const source = await shp.open(input.url);
    const features: GeoJSON.Feature[] = [];
    let reading = true;
    while (reading) {
      const result = await source.read();
      if (result.done) {
        reading = false;
      } else {
        features.push(result.value as GeoJSON.Feature);
      }
    }
    return features;
  }
  return [];
}
