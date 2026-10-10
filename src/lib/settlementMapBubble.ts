import { calculateAreaM2 } from "@/lib/geo";
import { parseGeometryFromField } from "@/lib/settlementMapLayers";
import type { SettlementRecord } from "@/types/settlement";

/** Screen-pixel radius. Area sets the size; the score does not. */
export const BUBBLE_RADIUS_MIN = 9;
export const BUBBLE_RADIUS_MAX = 24;
export const BUBBLE_RADIUS_DEFAULT = 12;

export type AreaScale = { low: number; high: number };

export type BubbleVisual = {
  radius: number;
  coreRadius: number;
  weight: number;
  fillOpacity: number;
  areaM2: number | null;
};

export function getSettlementInformalityScore(settlement: SettlementRecord): number | null {
  const raw = settlement.calculatedScores?.[0]?.finalInformalityScore;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return null;
}

/** Positive stored area, otherwise the polygon area. Missing area stays null. */
export function settlementAreaM2(settlement: SettlementRecord): number | null {
  if (typeof settlement.areaM2 === "number" && Number.isFinite(settlement.areaM2) && settlement.areaM2 > 0) {
    return settlement.areaM2;
  }
  const geometry = parseGeometryFromField(settlement.geometry as unknown);
  if (geometry?.type !== "Polygon" && geometry?.type !== "MultiPolygon") return null;
  try {
    const area = calculateAreaM2(geometry);
    return Number.isFinite(area) && area > 0 ? area : null;
  } catch {
    return null;
  }
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  const weight = pos - lo;
  return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

/** p5–p95 clip so a few extreme settlements do not set the whole scale. */
export function buildAreaScale(areas: number[]): AreaScale | null {
  const sorted = areas.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const low = quantile(sorted, 0.05);
  const high = quantile(sorted, 0.95);
  if (high > low) return { low, high };
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return { low: min, high: max };
}

/** Square-root scale from clipped area onto the pixel radius range. */
export function radiusFromArea(areaM2: number | null, scale: AreaScale | null): number {
  if (areaM2 === null || !Number.isFinite(areaM2) || areaM2 <= 0 || !scale) return BUBBLE_RADIUS_DEFAULT;
  if (!(scale.high > scale.low)) return (BUBBLE_RADIUS_MIN + BUBBLE_RADIUS_MAX) / 2;
  const clipped = Math.min(scale.high, Math.max(scale.low, areaM2));
  const span = Math.sqrt(scale.high) - Math.sqrt(scale.low);
  if (!(span > 0)) return (BUBBLE_RADIUS_MIN + BUBBLE_RADIUS_MAX) / 2;
  const t = (Math.sqrt(clipped) - Math.sqrt(scale.low)) / span;
  return BUBBLE_RADIUS_MIN + t * (BUBBLE_RADIUS_MAX - BUBBLE_RADIUS_MIN);
}

/** Inner core and ring express the stored score. A missing score stays neutral. */
export function scoreTone(score: number | null): { coreRatio: number; weight: number; fillOpacity: number } {
  if (score === null || !Number.isFinite(score)) {
    return { coreRatio: 0.46, weight: 1.5, fillOpacity: 0.34 };
  }
  const t = Math.min(1, Math.max(0, score));
  return {
    coreRatio: 0.32 + t * 0.4,
    weight: 1.15 + t * 2.1,
    fillOpacity: 0.22 + t * 0.38,
  };
}

export function buildBubbleVisuals(settlements: SettlementRecord[]): Map<string, BubbleVisual> {
  const areas = new Map<string, number | null>();
  const positive: number[] = [];
  for (const settlement of settlements) {
    const area = settlementAreaM2(settlement);
    areas.set(settlement.id, area);
    if (area !== null) positive.push(area);
  }
  const scale = buildAreaScale(positive);
  const visuals = new Map<string, BubbleVisual>();
  for (const settlement of settlements) {
    const areaM2 = areas.get(settlement.id) ?? null;
    const radius = radiusFromArea(areaM2, scale);
    const tone = scoreTone(getSettlementInformalityScore(settlement));
    const coreRadius = Math.min(radius - 2.5, Math.max(4, radius * tone.coreRatio));
    visuals.set(settlement.id, {
      radius,
      coreRadius,
      weight: tone.weight,
      fillOpacity: tone.fillOpacity,
      areaM2,
    });
  }
  return visuals;
}
