import { describe, expect, it } from "vitest";
import { buildSettlementMapLayerModel, parseGeometryFromField } from "./settlementMapLayers";
import type { SettlementRecord } from "@/types/settlement";

const base: Pick<SettlementRecord, "id" | "name" | "city" | "country" | "geometry" | "centroid" | "atlasReference" | "areaM2"> = {
  id: "1",
  name: "Test",
  city: null,
  country: null,
  geometry: "{}",
  centroid: "{}",
  atlasReference: false,
  areaM2: 0,
};

describe("buildSettlementMapLayerModel", () => {
  it("when communitySettlements is empty, no community polygons or markers", () => {
    const m = buildSettlementMapLayerModel([], []);
    expect(m.counts.communityPolygon).toBe(0);
    expect(m.counts.communityMarker).toBe(0);
    expect(m.polygonCollection.features.filter((f) => f.properties?.atlasReference === false)).toHaveLength(0);
    expect(m.markerItems.filter((x) => !x.isAtlas)).toHaveLength(0);
  });

  it("when communitySettlements has one polygon, one green polygon feature (community)", () => {
    const row = {
      ...base,
      id: "c1",
      geometry: JSON.stringify({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        ],
      }),
      centroid: JSON.stringify({ type: "Point", coordinates: [0.5, 0.5] }),
    } as SettlementRecord;
    const m = buildSettlementMapLayerModel([], [row]);
    expect(m.counts.communityPolygon).toBe(1);
    expect(m.counts.communityMarker).toBe(1);
    const commPoly = m.polygonCollection.features.filter((f) => f.properties?.atlasReference === false);
    expect(commPoly).toHaveLength(1);
    expect(commPoly[0].geometry.type).toBe("Polygon");
  });

  it("when communitySettlements has centroid-only record, one community marker", () => {
    const row = {
      ...base,
      id: "c2",
      geometry: JSON.stringify({ type: "LineString", coordinates: [] }),
      centroid: JSON.stringify({ type: "Point", coordinates: [-58.4, -34.6] }),
    } as SettlementRecord;
    const m = buildSettlementMapLayerModel([], [row]);
    expect(m.counts.communityPolygon).toBe(0);
    expect(m.counts.communityMarker).toBe(1);
    expect(m.markerItems.filter((x) => !x.isAtlas)).toHaveLength(1);
    expect(m.markerItems[0].center).toEqual([-34.6, -58.4]);
  });

  it("parses community geometry/centroid when stored as objects (not JSON strings)", () => {
    const row = {
      ...base,
      id: "c-obj",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        ],
      },
      centroid: { type: "Point", coordinates: [0.5, 0.5] },
    } as unknown as SettlementRecord;
    const m = buildSettlementMapLayerModel([], [row]);
    expect(m.communityPolygons).toHaveLength(1);
    expect(m.communityMarkers).toHaveLength(1);
  });

  it("parses double-encoded JSON geometry string", () => {
    const inner = JSON.stringify({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    });
    const row = {
      ...base,
      id: "c-double",
      geometry: JSON.stringify(inner),
      centroid: JSON.stringify({ type: "Point", coordinates: [0.5, 0.5] }),
    } as SettlementRecord;
    const m = buildSettlementMapLayerModel([], [row]);
    expect(parseGeometryFromField(row.geometry)).not.toBeNull();
    expect(m.communityPolygons).toHaveLength(1);
  });
});
