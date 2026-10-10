import { describe, expect, it } from "vitest";
import {
  BUBBLE_RADIUS_DEFAULT,
  BUBBLE_RADIUS_MAX,
  BUBBLE_RADIUS_MIN,
  buildAreaScale,
  buildBubbleVisuals,
  getSettlementInformalityScore,
  radiusFromArea,
  scoreTone,
  settlementAreaM2,
} from "./settlementMapBubble";
import type { SettlementRecord } from "@/types/settlement";

const square = JSON.stringify({
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [0.01, 0],
      [0.01, 0.01],
      [0, 0.01],
      [0, 0],
    ],
  ],
});

function row(partial: Partial<SettlementRecord> & Pick<SettlementRecord, "id">): SettlementRecord {
  return {
    name: partial.id,
    geometry: "{}",
    centroid: "{}",
    atlasReference: false,
    verificationStatus: "submitted",
    ...partial,
  };
}

describe("settlement map bubbles", () => {
  it("reads a stored score and keeps a missing score null", () => {
    expect(getSettlementInformalityScore(row({ id: "a", calculatedScores: [{ finalInformalityScore: 0, completenessScore: 1 }] }))).toBe(0);
    expect(getSettlementInformalityScore(row({ id: "b" }))).toBeNull();
  });

  it("uses a positive stored area and otherwise the polygon", () => {
    expect(settlementAreaM2(row({ id: "stored", areaM2: 5000, geometry: "not-json" }))).toBe(5000);
    expect(settlementAreaM2(row({ id: "poly", areaM2: 0, geometry: square }))).toBeGreaterThan(0);
    expect(settlementAreaM2(row({ id: "none", centroid: JSON.stringify({ type: "Point", coordinates: [10, 20] }) }))).toBeNull();
  });

  it("maps clipped area onto the radius range and ignores the score", () => {
    const scale = buildAreaScale([100, 1_000, 10_000, 100_000, 5_000_000]);
    expect(scale).not.toBeNull();
    const small = radiusFromArea(100, scale);
    const mid = radiusFromArea(10_000, scale);
    const huge = radiusFromArea(5_000_000, scale);
    expect(small).toBe(BUBBLE_RADIUS_MIN);
    expect(huge).toBe(BUBBLE_RADIUS_MAX);
    expect(mid).toBeGreaterThan(small);
    expect(mid).toBeLessThan(huge);
    expect(radiusFromArea(null, scale)).toBe(BUBBLE_RADIUS_DEFAULT);
    expect(radiusFromArea(10_000, null)).toBe(BUBBLE_RADIUS_DEFAULT);
  });

  it("keeps one shared radius for the same area when scores differ", () => {
    const visuals = buildBubbleVisuals([
      row({ id: "low", areaM2: 1_000, calculatedScores: [{ finalInformalityScore: 0, completenessScore: 1 }] }),
      row({ id: "high", areaM2: 1_000, calculatedScores: [{ finalInformalityScore: 1, completenessScore: 1 }] }),
      row({ id: "missing", areaM2: 1_000 }),
      row({ id: "large", areaM2: 80_000, calculatedScores: [{ finalInformalityScore: 0.2, completenessScore: 1 }] }),
      row({ id: "point" }),
    ]);
    expect(visuals.get("low")?.radius).toBe(visuals.get("high")?.radius);
    expect(visuals.get("large")?.radius).toBeGreaterThan(visuals.get("low")?.radius ?? 0);
    expect(visuals.get("point")?.radius).toBe(BUBBLE_RADIUS_DEFAULT);
    expect(scoreTone(1).coreRatio).toBeGreaterThan(scoreTone(0).coreRatio);
    expect(scoreTone(null).coreRatio).not.toBe(scoreTone(0).coreRatio);
    expect(visuals.get("high")?.coreRadius).toBeGreaterThan(visuals.get("low")?.coreRadius ?? 0);
  });
});
